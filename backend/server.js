require('dotenv').config();

process.on('uncaughtException', (err) => {
    console.error('CRITICAL UNCAUGHT EXCEPTION:', err);
    require('fs').appendFileSync('server_error.log', `[${new Date().toISOString()}] Uncaught Exception: ${err.message}\n${err.stack}\n\n`);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL UNHANDLED REJECTION:', reason);
    require('fs').appendFileSync('server_error.log', `[${new Date().toISOString()}] Unhandled Rejection: ${reason}\n\n`);
});

const express = require('express');
const cors = require('cors');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const nodemailer = require('nodemailer');
const pool = require('./db');
const OpenAI = require("openai");
const multer = require('multer');
const Tesseract = require('tesseract.js');
const { tavily } = require("@tavily/core");
const tvly = tavily({ apiKey: process.env.TAVILY_API_KEY });
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const rateLimit = require('express-rate-limit');
// Handle pdf-parse export variability (v1 vs v2)
let pdf;
try {
    const pdfImport = require('pdf-parse');
    if (typeof pdfImport === 'function') {
        pdf = pdfImport;
    } else if (pdfImport.default && typeof pdfImport.default === 'function') {
        pdf = pdfImport.default;
    } else {
        console.warn('pdf-parse import is unexpected:', typeof pdfImport);
        pdf = pdfImport;
    }
} catch (e) {
    console.error('Failed to import pdf-parse:', e);
}
const mammoth = require('mammoth');

const app = express();
const http = require('http');
const { Server } = require("socket.io");
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000',
        methods: ["GET", "POST"]
    }
});
const PORT = process.env.PORT || 5000;
const RESET_TOKEN_EXPIRY_MINUTES = Number(process.env.PASSWORD_RESET_EXPIRY_MINUTES || 30);

// Configure Multer for memory storage
const upload = multer({ storage: multer.memoryStorage() });

// Initialize OpenAI client for Groq
const client = new OpenAI({
    apiKey: process.env.GROQ_API_KEY,
    baseURL: "https://api.groq.com/openai/v1",
});

// Restrict CORS to the configured frontend origin
app.use(cors({ origin: process.env.ALLOWED_ORIGIN || 'http://localhost:3000' }));
app.use(express.json({ limit: '50mb' })); // Increased for RAG payloads

app.use(passport.initialize());

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy_client_id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy_client_secret',
    callbackURL: "http://localhost:5000/api/auth/google/callback"
  },
  async function(accessToken, refreshToken, profile, cb) {
    try {
        let userResult = await pool.query('SELECT * FROM users WHERE google_id = $1 OR email = $2', [profile.id, profile.emails[0].value]);
        if (userResult.rows.length > 0) {
            let user = userResult.rows[0];
            if (!user.google_id) {
                await pool.query('UPDATE users SET google_id = $1 WHERE id = $2', [profile.id, user.id]);
            }
            return cb(null, user);
        } else {
            const result = await pool.query(
                'INSERT INTO users (name, email, google_id) VALUES ($1, $2, $3) RETURNING *',
                [profile.displayName, profile.emails[0].value, profile.id]
            );
            return cb(null, result.rows[0]);
        }
    } catch(err) {
        return cb(err, null);
    }
  }
));

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // limit each IP to 20 requests per windowMs
    message: { error: 'Too many requests, please try again later.' }
});

async function ensurePasswordResetTable() {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                used_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS idx_password_resets_token_hash ON password_resets(token_hash);
        `);
    } catch (error) {
        console.error('Error ensuring password_resets table:', error);
    }
}

ensurePasswordResetTable();

function getPasswordResetBaseUrl() {
    if (process.env.FRONTEND_RESET_URL) {
        return process.env.FRONTEND_RESET_URL;
    }
    const frontendBase = process.env.ALLOWED_ORIGIN || 'http://localhost:3000';
    return `${frontendBase}/reset-password`;
}

async function sendPasswordResetEmail(to, resetLink) {
    const { SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM } = process.env;
    if (!SMTP_HOST || !SMTP_PORT || !SMTP_USER || !SMTP_PASS) {
        console.log(`Password reset link for ${to}: ${resetLink}`);
        return false;
    }

    const transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: Number(SMTP_PORT),
        secure: Number(SMTP_PORT) === 465,
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        }
    });

    await transporter.sendMail({
        from: SMTP_FROM || SMTP_USER,
        to,
        subject: 'Reset your Echo AI password',
        text: `You requested a password reset.\n\nUse this link to reset your password:\n${resetLink}\n\nThis link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.`,
        html: `
            <p>You requested a password reset.</p>
            <p><a href="${resetLink}">Click here to reset your password</a></p>
            <p>This link expires in ${RESET_TOKEN_EXPIRY_MINUTES} minutes.</p>
        `
    });
    return true;
}

let pipeline;
try {
    const transformers = require('@xenova/transformers');
    pipeline = transformers.pipeline;
} catch (e) {
    console.log("Transformers.js not installed or failed to load. Run 'npm install @xenova/transformers'");
}

// Load RAG Pipeline
let extractor;
if (pipeline) {
    (async () => {
        try {
            extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { quantized: true });
            console.log('Embedding model loaded successfully.');
        } catch (e) {
            console.error('Failed to load embedding model:', e);
        }
    })();
}

// RAG Helper Functions
function chunkText(text, maxChars = 1000) {
    const words = text.split(/\s+/);
    let chunks = [];
    let currentChunk = [];
    let currentCharCount = 0;

    for (let word of words) {
        if (currentCharCount + word.length > maxChars && currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
            currentChunk = [];
            currentCharCount = 0;
        }
        currentChunk.push(word);
        currentCharCount += word.length + 1;
    }
    if (currentChunk.length > 0) {
        chunks.push(currentChunk.join(' '));
    }
    return chunks;
}

function cosineSimilarity(vecA, vecB) {
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < vecA.length; i++) {
        dotProduct += vecA[i] * vecB[i];
        normA += vecA[i] * vecA[i];
        normB += vecB[i] * vecB[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function performWebSearch(query) {
    try {
        console.log(`Performing live Tavily web search for: "${query}"`);
        const searchResults = await tvly.search(query, {
            searchDepth: "basic",
            maxResults: 5,
            includeAnswer: true
        });
        
        if (searchResults && searchResults.results && searchResults.results.length > 0) {
            let context = searchResults.results.map((r, i) => `[Source ${i+1}: ${r.title}] (${r.url})\nSnippet: ${r.content}`).join('\n\n');
            if (searchResults.answer) {
                context = `Summary: ${searchResults.answer}\n\n` + context;
            }
            return context;
        }
        return "No relevant search results found for the user's query.";
    } catch (e) {
        console.error("Tavily Search Error:", e);
        throw e;
    }
}


// Debug middleware for upload
app.use('/api/upload', (req, res, next) => {
    console.log(`Incoming request to /api/upload. Headers:`, req.headers['content-type']);
    next();
});

// File Upload Endpoint
app.post('/api/upload', upload.single('file'), async (req, res) => {
    console.log("Received upload request");
    if (!req.file) {
        console.log("No file part found in request");
        return res.status(400).json({ error: 'No file uploaded' });
    }

    console.log(`Processing file: ${req.file.originalname}, Type: ${req.file.mimetype}, Size: ${req.file.size} bytes`);

    try {
        let extractedText = '';
        const buffer = req.file.buffer;
        const mimeType = req.file.mimetype;

        // Extract Text or base64 based on file type
        if (mimeType === 'application/pdf') {
            console.log("Parsing PDF...");
            const data = await pdf(buffer);
            extractedText = data.text;
        } else if (mimeType.startsWith('image/')) {
            console.log("Running OCR on image...");
            const result = await Tesseract.recognize(buffer, 'eng');
            extractedText = `[Image: ${req.file.originalname}]\n` + result.data.text;
        } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // DOCX
            console.log("Parsing DOCX...");
            const result = await mammoth.extractRawText({ buffer: buffer });
            extractedText = result.value;
        } else if (mimeType.startsWith('text/') || mimeType === 'application/javascript' || mimeType === 'application/json') {
            console.log("Reading text file...");
            extractedText = buffer.toString('utf8');
        } else {
            console.log(`Unsupported file type: ${mimeType}`);
            return res.status(400).json({ error: 'Unsupported file type: ' + mimeType });
        }

        console.log(`Extraction successful. Text length: ${extractedText.length}`);
        res.json({ text: extractedText, filename: req.file.originalname });

    } catch (error) {
        console.error('CRITICAL Error processing file:', error);

        // Write to log file
        try {
            const fs = require('fs');
            const logMessage = `[${new Date().toISOString()}] Error: ${error.message}\nStack: ${error.stack}\nFull: ${JSON.stringify(error, Object.getOwnPropertyNames(error))}\n\n`;
            fs.appendFileSync('server_error.log', logMessage);
        } catch (logErr) {
            console.error("Failed to write log:", logErr);
        }

        res.status(500).json({ error: 'Failed to process file', details: error.message || 'Unknown Error' });
    }
});

app.post('/api/chat', async (req, res) => {
    try {
        const { messages, mode, files } = req.body;

        if (!messages || !Array.isArray(messages)) {
            return res.status(400).json({ error: 'Messages array is required' });
        }

        let formattedMessages = messages.map(msg => ({
            role: msg.role === 'ai' ? 'assistant' : msg.role,
            content: msg.content
        }));

        // Modes System Prompts
        let systemPromptText = "You are Echo AI, a highly capable, intelligent, and helpful voice assistant. You are concise and conversational. When asked a coding question, output markdown code blocks. Keep responses relatively short unless asked to explain in detail.";
        
        if (mode === 'coding') {
            systemPromptText = `You are an elite competitive programmer and senior software engineer. 
When the user asks a coding question, you MUST explicitly follow this strict format:

1. **Analysis & Approaches**: 
   - Briefly discuss the **Common/Naive Approach** (time/space complexity).
   - Discuss a **Better Approach**.
   - Conclude with the **Optimal Approach**.

2. **Optimal Solution**: 
   - Provide the code for the optimal approach.
   - **CRITICAL:** THE CODE MUST BE ABSOLUTELY COMMENT-FREE.
     - NO inline comments (e.g., '# ...', '// ...').
     - NO docstrings(e.g., ''' ... ''', '/** ... */').
     - NO explanations inside the code block.
   - The code MUST pass all edge cases(empty inputs, large inputs, negative numbers, etc.).
   - JUST THE RAW CODE.

3. ** Detailed Explanation **:
   - Explain the logic of the optimal solution step - by - step.

4. ** Test Cases & Edge Cases **:
   - List specific Test Cases(Normal, Edge, Invalid).
   - Trace the execution of the code with one Edge Case to prove it works.

Your goal is to provide a complete, robust, and educational answer.`;
        } else if (mode === 'summarization') {
            systemPromptText = `You are an expert professional writer and editor.
Your goal is to provide high-quality, polished, and human-sounding text.
- If asked to **Summarize**: Provide a concise, bulleted summary capturing key points.
- If asked to **Fix Grammar**: vivid, correct, and professional. Show changes if possible.
- If asked to **Rewrite/Humanize**: Make it sound natural, engaging, and flow well.`;
        } else if (mode === 'files') {
            systemPromptText = "You are currently in FILES MODE. The user has uploaded files. Use the provided excerpts from these files to answer their questions. If the answer is not in the files, use your general knowledge but mention it's not in the files.";
        } else if (mode === 'search') {
            systemPromptText = "You are currently in WEB SEARCH MODE. The system has automatically performed a live web search to gather real-time context for the user's question. Use the provided search results to answer the user accurately and concisely. ALWAYS mention if the information provided comes from a specific source (e.g. 'According to [Source Name]...'). If the search results do not contain the answer, explicitly state that the live search did not find the information.";

            try {
                const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content || "";
                if (lastUserMessage) {
                    console.log(`Performing live web search for: "${lastUserMessage}"`);
                    const searchContext = await performWebSearch(lastUserMessage);
                    systemPromptText += `\n\n--- LIVE SEARCH RESULTS ---\n${searchContext}\n---------------------------`;
                }
            } catch (e) {
                console.error("Web Search Error:", e);
                systemPromptText += `\n\n[Warning: Live Web Search failed due to an internal error or rate limiting. Please rely on your general knowledge.]`;
            }
        }

        if (files && files.length > 0) {
            let relevantContexts = [];
            
            // Get user's query for semantic search
            const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content || "";
            let queryEmbedding = null;
            if (lastUserMessage && extractor) {
                try {
                    const output = await extractor(lastUserMessage, { pooling: 'mean', normalize: true });
                    queryEmbedding = Array.from(output.data);
                } catch(e) { console.error("Error embedding query:", e); }
            }

            for (let f of files) {
                if (f.chunks && f.chunks.length > 0 && queryEmbedding) {
                    // Score chunks using cosine similarity
                    const scoredChunks = f.chunks.map(c => ({
                        text: c.text,
                        score: cosineSimilarity(queryEmbedding, c.embedding)
                    }));
                    // Sort descending by score
                    scoredChunks.sort((a, b) => b.score - a.score);
                    // Take top 3 most relevant chunks
                    const topChunks = scoredChunks.slice(0, 3);
                    relevantContexts.push(`File: ${f.name}\nRelevant Excerpts:\n` + topChunks.map((c, i) => `[Excerpt ${i+1}]: ${c.text}`).join('\n\n'));
                } else {
                    // Fallback if no embeddings or chunks are present
                    relevantContexts.push(`File: ${f.name}\nContent:\n${f.content.substring(0, 3000)}... (truncated)`);
                }
            }
            
            if (relevantContexts.length > 0) {
                systemPromptText += `\n\nYou have access to the following files uploaded by the user. Use the provided relevant excerpts to answer the user's questions accurately:\n\n${relevantContexts.join('\n\n')}`;
            }
        }
        
        formattedMessages.unshift({ role: "system", content: systemPromptText });

        const chatCompletion = await client.chat.completions.create({
            messages: formattedMessages,
            model: "llama-3.3-70b-versatile",
        });

        const text = chatCompletion.choices[0].message.content;

        res.json({ response: text });

    } catch (error) {
        console.error('Error connecting to Groq:', error);
        res.status(500).json({
            error: 'Failed to fetch response from AI',
            details: error.message
        });
    }
});

// --- Auth Routes ---
app.post('/api/auth/signup', authLimiter, async (req, res) => {
    try {
        const { name, email, password } = req.body;

        if (!email || !password || !name) {
            return res.status(400).json({ error: 'Name, email, and password are required' });
        }

        const userExists = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        if (userExists.rows.length > 0) {
            return res.status(400).json({ error: 'User with this email already exists' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const result = await pool.query(
            'INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING id, name, email',
            [name, email, hashedPassword]
        );

        res.status(201).json({ message: 'User created successfully', user: result.rows[0] });
    } catch (error) {
        console.error('Error in signup:', error);
        res.status(500).json({ error: 'Internal server error during signup' });
    }
});

app.post('/api/auth/signin', authLimiter, async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
        const user = result.rows[0];

        if (!user) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        if (!user.password_hash) {
            return res.status(401).json({ error: 'Please sign in with Google' });
        }

        const isMatch = await bcrypt.compare(password, user.password_hash);
        if (!isMatch) {
            return res.status(401).json({ error: 'Invalid email or password' });
        }

        // Require JWT_SECRET — never fall back to a hardcoded value
        if (!process.env.JWT_SECRET) {
            console.error('FATAL: JWT_SECRET environment variable is not set.');
            return res.status(500).json({ error: 'Server configuration error. Please contact support.' });
        }
        const token = jwt.sign(
            { id: user.id, email: user.email },
            process.env.JWT_SECRET,
            { expiresIn: '24h' }
        );

        res.json({
            message: 'Signed in successfully',
            token,
            user: { id: user.id, name: user.name, email: user.email }
        });
    } catch (error) {
        console.error('Error in signin:', error);
        res.status(500).json({ error: 'Internal server error during signin' });
    }
});

app.post('/api/auth/forgot-password', authLimiter, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({ error: 'Email is required' });
        }

        const genericMessage = 'If an account with that email exists, a password reset link has been sent.';
        const userResult = await pool.query('SELECT id, email FROM users WHERE LOWER(email) = LOWER($1)', [email.trim()]);
        if (userResult.rows.length === 0) {
            return res.json({ message: genericMessage });
        }

        const user = userResult.rows[0];
        const rawToken = crypto.randomBytes(32).toString('hex');
        const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
        const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MINUTES * 60 * 1000);

        await pool.query('DELETE FROM password_resets WHERE user_id = $1 OR expires_at < NOW() OR used_at IS NOT NULL', [user.id]);
        await pool.query(
            'INSERT INTO password_resets (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
            [user.id, tokenHash, expiresAt]
        );

        const resetLink = `${getPasswordResetBaseUrl()}?token=${encodeURIComponent(rawToken)}`;
        const emailed = await sendPasswordResetEmail(user.email, resetLink);

        return res.json({
            message: genericMessage,
            ...(emailed ? {} : { devResetLink: resetLink })
        });
    } catch (error) {
        console.error('Error in forgot-password:', error);
        res.status(500).json({ error: 'Internal server error during forgot-password' });
    }
});

app.post('/api/auth/reset-password', async (req, res) => {
    const dbClient = await pool.connect();
    try {
        const { token, newPassword } = req.body;
        if (!token || !newPassword) {
            return res.status(400).json({ error: 'Token and new password are required' });
        }
        if (newPassword.length < 6) {
            return res.status(400).json({ error: 'New password must be at least 6 characters long' });
        }

        const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
        const resetResult = await pool.query(
            `SELECT id, user_id
             FROM password_resets
             WHERE token_hash = $1 AND used_at IS NULL AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`,
            [tokenHash]
        );

        if (resetResult.rows.length === 0) {
            return res.status(400).json({ error: 'Invalid or expired reset token' });
        }

        const resetRecord = resetResult.rows[0];
        const passwordHash = await bcrypt.hash(newPassword, 10);

        await dbClient.query('BEGIN');
        await dbClient.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, resetRecord.user_id]);
        await dbClient.query('UPDATE password_resets SET used_at = NOW() WHERE id = $1', [resetRecord.id]);
        await dbClient.query('COMMIT');

        return res.json({ message: 'Password reset successful. You can now sign in.' });
    } catch (error) {
        await dbClient.query('ROLLBACK');
        console.error('Error in reset-password:', error);
        res.status(500).json({ error: 'Internal server error during reset-password' });
    } finally {
        dbClient.release();
    }
});

app.get('/api/auth/init-db', async (req, res) => {
    try {
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                email VARCHAR(255) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
            
            CREATE TABLE IF NOT EXISTS chats (
                id VARCHAR(255) PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255),
                mode VARCHAR(50),
                is_pinned BOOLEAN DEFAULT false,
                is_archived BOOLEAN DEFAULT false,
                files JSONB DEFAULT '[]'::jsonb,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                chat_id VARCHAR(255) REFERENCES chats(id) ON DELETE CASCADE,
                role VARCHAR(50) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS password_resets (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                token_hash VARCHAR(255) NOT NULL,
                expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
                used_at TIMESTAMP WITH TIME ZONE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );
        `);
        res.json({ message: 'Database initialized successfully' });
    } catch (error) {
        console.error('Error initializing database:', error);
        res.status(500).json({ error: 'Failed to initialize database' });
    }
});

// Google OAuth Routes
app.get('/api/auth/google',
  passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

app.get('/api/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: 'http://localhost:3000/signin?error=google_auth_failed', session: false }),
  function(req, res) {
    if (!process.env.JWT_SECRET) {
        return res.status(500).send('Server configuration error.');
    }
    const token = jwt.sign(
        { id: req.user.id, email: req.user.email, name: req.user.name },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
    );
    res.redirect(`${process.env.ALLOWED_ORIGIN || 'http://localhost:3000'}/signin?token=${token}&name=${encodeURIComponent(req.user.name)}`);
  });

// --- Authentication Middleware ---
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token) return res.status(401).json({ error: 'Access denied. No token provided.' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(403).json({ error: 'Invalid or expired token.' });
        req.user = user;
        next();
    });
};

// --- Chat History Routes ---

// Get all chats for the authenticated user
app.get('/api/chats', authenticateToken, async (req, res) => {
    try {
        const chatsResult = await pool.query(
            'SELECT * FROM chats WHERE user_id = $1 ORDER BY updated_at DESC',
            [req.user.id]
        );
        
        const chats = chatsResult.rows;
        
        // Fetch messages for each chat
        for (let chat of chats) {
            const messagesResult = await pool.query(
                'SELECT role, content FROM messages WHERE chat_id = $1 ORDER BY id ASC',
                [chat.id]
            );
            chat.messages = messagesResult.rows;
            chat.files = chat.files || [];
            
            // Map keys for frontend (is_pinned -> isPinned, is_archived -> isArchived)
            chat.isPinned = chat.is_pinned;
            chat.isArchived = chat.is_archived;
            delete chat.is_pinned;
            delete chat.is_archived;
        }
        
        res.json(chats);
    } catch (error) {
        console.error('Error fetching chats:', error);
        res.status(500).json({ error: 'Failed to fetch chats' });
    }
});

// Sync (upsert) a chat and its messages
app.post('/api/chats/sync', authenticateToken, async (req, res) => {
    const client = await pool.connect();
    try {
        const { id, title, timestamp, messages, mode, folder, files, isPinned, isArchived } = req.body;
        
        if (!id) return res.status(400).json({ error: 'Chat ID is required' });

        await client.query('BEGIN');

        // Upsert chat
        await client.query(`
            INSERT INTO chats (id, user_id, title, mode, folder, is_pinned, is_archived, files, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                mode = EXCLUDED.mode,
                folder = EXCLUDED.folder,
                is_pinned = EXCLUDED.is_pinned,
                is_archived = EXCLUDED.is_archived,
                files = EXCLUDED.files,
                updated_at = NOW()
        `, [id, req.user.id, title, mode, folder || null, isPinned || false, isArchived || false, JSON.stringify(files || [])]);

        // Delete existing messages and re-insert them (simplest way to sync)
        await client.query('DELETE FROM messages WHERE chat_id = $1', [id]);
        
        if (messages && messages.length > 0) {
            for (let msg of messages) {
                await client.query(
                    'INSERT INTO messages (chat_id, role, content) VALUES ($1, $2, $3)',
                    [id, msg.role, msg.content]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ message: 'Chat synced successfully' });
    } catch (error) {
        await client.query('ROLLBACK');
        console.error('Error syncing chat:', error);
        res.status(500).json({ error: 'Failed to sync chat' });
    } finally {
        client.release();
    }
});

// Delete a chat
app.delete('/api/chats/:id', authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        // Verify ownership
        const chatCheck = await pool.query('SELECT user_id FROM chats WHERE id = $1', [id]);
        if (chatCheck.rows.length === 0) return res.status(404).json({ error: 'Chat not found' });
        if (chatCheck.rows[0].user_id !== req.user.id) return res.status(403).json({ error: 'Unauthorized' });

        await pool.query('DELETE FROM chats WHERE id = $1', [id]);
        res.json({ message: 'Chat deleted' });
    } catch (error) {
        console.error('Error deleting chat:', error);
        res.status(500).json({ error: 'Failed to delete chat' });
    }
});

// Global Error Handler (Must be last)
app.use((err, req, res, next) => {
    console.error('Unhandled Middleware Error:', err);

    // Write to log file
    try {
        const fs = require('fs');
        const logMessage = `[${new Date().toISOString()}] Middleware Error: ${err.message}\nStack: ${err.stack}\n\n`;
        fs.appendFileSync('server_error.log', logMessage);
    } catch (logErr) {
        console.error("Failed to write log:", logErr);
    }

    if (err instanceof multer.MulterError) {
        return res.status(400).json({ error: 'Upload Error', details: err.message });
    }

    res.status(500).json({ error: 'Internal Server Error', details: err.message });
});

// --- WebSocket Handling ---
io.on('connection', (socket) => {
    console.log('A user connected via WebSocket:', socket.id);

    socket.on('chatMessage', async (data) => {
        try {
            const { messages, mode, files } = data;

            if (!messages || !Array.isArray(messages)) {
                return socket.emit('chatError', { error: 'Messages array is required' });
            }

            let formattedMessages = messages.map(msg => ({
                role: msg.role === 'ai' ? 'assistant' : msg.role,
                content: msg.content
            }));

            // Modes System Prompts
            let systemPromptText = "You are Echo AI, a highly capable, intelligent, and helpful voice assistant. You are concise and conversational. When asked a coding question, output markdown code blocks. Keep responses relatively short unless asked to explain in detail.";
            
            if (mode === 'coding') {
                systemPromptText = `You are an elite competitive programmer and senior software engineer. \nWhen the user asks a coding question, you MUST explicitly follow this strict format:\n\n1. **Analysis & Approaches**: \n   - Briefly discuss the **Common/Naive Approach** (time/space complexity).\n   - Discuss a **Better Approach**.\n   - Conclude with the **Optimal Approach**.\n\n2. **Optimal Solution**: \n   - Provide the code for the optimal approach.\n   - **CRITICAL:** THE CODE MUST BE ABSOLUTELY COMMENT-FREE.\n     - NO inline comments (e.g., '# ...', '// ...').\n     - NO docstrings(e.g., ''' ... ''', '/** ... */').\n     - NO explanations inside the code block.\n   - The code MUST pass all edge cases(empty inputs, large inputs, negative numbers, etc.).\n   - JUST THE RAW CODE.\n\n3. ** Detailed Explanation **:\n   - Explain the logic of the optimal solution step - by - step.\n\n4. ** Test Cases & Edge Cases **:\n   - List specific Test Cases(Normal, Edge, Invalid).\n   - Trace the execution of the code with one Edge Case to prove it works.\n\nYour goal is to provide a complete, robust, and educational answer.`;
            } else if (mode === 'summarization') {
                systemPromptText = `You are an expert professional writer and editor.\nYour goal is to provide high-quality, polished, and human-sounding text.\n- If asked to **Summarize**: Provide a concise, bulleted summary capturing key points.\n- If asked to **Fix Grammar**: vivid, correct, and professional. Show changes if possible.\n- If asked to **Rewrite/Humanize**: Make it sound natural, engaging, and flow well.`;
            } else if (mode === 'files') {
                systemPromptText = "You are currently in FILES MODE. The user has uploaded files. Use the provided excerpts from these files to answer their questions. If the answer is not in the files, use your general knowledge but mention it's not in the files.";
            } else if (mode === 'search') {
                systemPromptText = "You are currently in WEB SEARCH MODE. The system has automatically performed a live web search to gather real-time context for the user's question. Use the provided search results to answer the user accurately and concisely. ALWAYS mention if the information provided comes from a specific source (e.g. 'According to [Source Name]...'). If the search results do not contain the answer, explicitly state that the live search did not find the information.";

                try {
                    const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content || "";
                    if (lastUserMessage) {
                        console.log(`Performing live web search for: "${lastUserMessage}"`);
                        const searchContext = await performWebSearch(lastUserMessage);
                        systemPromptText += `\n\n--- LIVE SEARCH RESULTS ---\n${searchContext}\n---------------------------`;
                    }
                } catch (e) {
                    console.error("Web Search Error:", e);
                    systemPromptText += `\n\n[Warning: Live Web Search failed due to an internal error or rate limiting. Please rely on your general knowledge.]`;
                }
            }

            if (files && files.length > 0) {
                let relevantContexts = [];
                
                const lastUserMessage = messages.slice().reverse().find(m => m.role === 'user')?.content || "";
                let queryEmbedding = null;
                if (lastUserMessage && extractor) {
                    try {
                        const output = await extractor(lastUserMessage, { pooling: 'mean', normalize: true });
                        queryEmbedding = Array.from(output.data);
                    } catch(e) { console.error("Error embedding query:", e); }
                }

                for (let f of files) {
                    if (f.chunks && f.chunks.length > 0 && queryEmbedding) {
                        const scoredChunks = f.chunks.map(c => ({
                            text: c.text,
                            score: cosineSimilarity(queryEmbedding, c.embedding)
                        }));
                        scoredChunks.sort((a, b) => b.score - a.score);
                        const topChunks = scoredChunks.slice(0, 3);
                        relevantContexts.push(`File: ${f.name}\nRelevant Excerpts:\n` + topChunks.map((c, i) => `[Excerpt ${i+1}]: ${c.text}`).join('\n\n'));
                    } else {
                        relevantContexts.push(`File: ${f.name}\nContent:\n${f.content.substring(0, 3000)}... (truncated)`);
                    }
                }
                
                if (relevantContexts.length > 0) {
                    systemPromptText += `\n\nYou have access to the following files uploaded by the user. Use the provided relevant excerpts to answer the user's questions accurately:\n\n${relevantContexts.join('\n\n')}`;
                }
            }
            
            formattedMessages.unshift({ role: "system", content: systemPromptText });

            const chatCompletion = await client.chat.completions.create({
                messages: formattedMessages,
                model: "llama-3.3-70b-versatile",
                stream: true,
            });

            for await (const chunk of chatCompletion) {
                const content = chunk.choices[0]?.delta?.content || '';
                if (content) {
                    socket.emit('chatChunk', { content });
                }
            }
            socket.emit('chatComplete');

        } catch (error) {
            console.error('Error connecting to Groq via WebSocket:', error);
            socket.emit('chatError', { error: 'Failed to fetch response from AI', details: error.message });
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

server.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
