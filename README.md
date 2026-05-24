# Echo AI — High-Performance Multi-Modal ML & Conversational NLP Platform

Echo AI is an end-to-end multi-modal platform integrating real-time Automatic Speech Recognition (ASR), Natural Language Processing (NLP) models, Computer Vision OCR pipelines, and context-grounded retrieval to build a low-latency, responsive conversational assistant. The project features advanced web agent search grounding, real-time audio signal processing visualizers, and state-preserving session routing over full-duplex WebSocket connections.

---

## 🚀 ML & NLP System Features

*   **🎙️ Automatic Speech Recognition (ASR) & Digital Signal Processing (DSP):** Hands-free voice interactions powered by native speech-to-text models.
    *   **Mic DSP Constraints:** Integrates hardware-level audio filtering (`noiseSuppression`, `echoCancellation`, and `autoGainControl`) to cleanly isolate the speaker's vocal frequency from steady background noise (fans, hums, traffic).
    *   **Temporal Silence Segmentation:** Incorporates a 5-second silence-detection timer that automatically segments, packages, and commits voice queries to the NLP processing pipeline once active speech terminates.
    *   **Audio Web API Integration:** Converts raw microphone signals into real-time visual 3D particle sphere physics using the Web Audio API for interactive sensory feedback.
*   **📂 Multi-Modal Computer Vision (OCR) & PDF Token Extraction Pipeline:**
    *   **Document Parsing:** Parses hierarchical metadata and raw text from multi-page PDF documents.
    *   **CNN-Based OCR (Tesseract.js):** Executes optical character recognition on scanned images and hand-drawn screenshots using deep learning spatial character mapping, feeding clean text representations into the conversational context.
*   **🧠 Natural Language Intent Classification & Prompt Routing:**
    *   **Dynamic Intent Inference:** Scans user inputs dynamically using zero-latency keyword routing models to predict user intent (e.g., General Chatting, Logical/Software Synthesizing, Text Summarization/Linguistic Polish, or Document Grounded Question-Answering).
    *   **System Prompt Modification:** Dynamically updates and switches the LLM's system instructions and behavioral configurations in the background, matching inferred intent instantly without user configuration.
*   **🌐 Real-Time Semantic Web Search Grounding:**
    *   **RAG Web Agent Integration:** Utilizes Tavily Search API to execute semantic web queries, bypassing model static knowledge limitations and feeding real-world search context into the inference loop.
*   **💬 High-Throughput Token Streaming & WebSockets:**
    *   **Duplex Autoregressive Streaming:** Uses Socket.io full-duplex connections to stream LLM responses token-by-token instead of waiting for full generation blocking, delivering fluid, real-time text and markdown rendering.
*   **🔐 Secure Session-Level User Partitioning:**
    *   **JWT Context Isolation:** Secures and isolates chat history, settings, and file contexts using cryptographically signed JSON Web Tokens (JWT) for multi-tenant database protection.
*   **🌓 Adaptive HSL Glassmorphism Interface:**
    *   Responsive modern frontend styled with curated CSS variables for lightweight theme switching with 0 framework overhead.

---

## 🛠️ Technology Stack

### Frontend
*   **Core:** React (v18.x), React Router DOM (v6.x)
*   **Microphone/TTS:** Web Speech API, `react-speech-recognition`
*   **Styling:** Custom Vanilla CSS (Fluid flexboxes, CSS variables, keyframe animations, backdrop filters)
*   **Icons:** Lucide React
*   **Markdown:** React Markdown, React Syntax Highlighting, Remark GFM

### Backend
*   **Server Engine:** Node.js, Express, Socket.io (Low-latency duplex streaming)
*   **Database:** PostgreSQL (Client connection pooling via `pg`)
*   **OCR & File Parsing:** Tesseract.js (Optical Character Recognition), `pdf-parse`, `multer` (multipart-form buffer parsing)
*   **APIs:** Groq API / Google Generative AI (Gemini Studio API), Tavily Web Search API
*   **Security:** JSON Web Tokens (JWT), `bcryptjs` (password hashing)



## 📂 Repository Structure

```text
voice-assistant/
├── backend/                    # Node.js Express server backend
│   ├── node_modules/           # Backend dependencies
│   ├── db.js                   # pg Pool instance with connection hooks
│   ├── db_init.js              # Database tables schema creation script
│   ├── server.js               # Express application router, WebSockets & OCR pipeline
│   ├── .env                    # Private backend API keys & database URLs
│   └── package.json            # Node configuration & scripts
│
├── voice-assistant/            # React frontend client
│   ├── public/                 # Static public assets
│   │   ├── index.html          # Main HTML entrypoint
│   │
│   ├── src/                    # Frontend source files
│   │   ├── index.js            # App wrapper and bootloader
│   │   ├── index.css           # Global theme variables, reset and scrollbars
│   │   ├── App.js              # Main application router
│   │   ├── App.css             # Root structure, header and nav styling
│   │   ├── ChatInterface.js    # Core messaging dashboard (Restores states)
│   │   ├── ChatInterface.css   # Chat screen layouts, grid and custom overlays
│   │   ├── VoiceSphere.js      # Mic UI, Audio constraint, and 3D Canvas visualizer
│   │   ├── DeveloperInfo.js    # Developer showcase page
│   │   ├── DeveloperInfo.css   # Profile card layouts and lighting glows
│   │   ├── MessageBubble.js    # Custom bubbles supporting Markdown parsing
│   │   ├── Settings.js         # Theme preferences and system details
│   │   ├── Sidebar.js          # Chat history directory browser
│   │   ├── SignIn.js           # Authentication forms and handlers
│   │   └── TranscriptContext.js# Shared context state for mic transcripts
│   │
│   ├── .env                    # Public React environment variables
│   └── package.json            # Frontend dependency manager
│
└── README.md                   # This overview
```

---

## 🛠️ Step-by-Step Installation

### Prerequisites
*   **Node.js** (v16.x or higher installed)
*   **PostgreSQL** (Active local database or a hosted solution like Neon/Supabase)

### 1. Database Setup
1. Create a blank database on your PostgreSQL host named `Echo` (or any custom name).
2. Save your connection URL: `postgresql://[username]:[password]@[host]:[port]/[database]`

### 2. Backend Installation & Setup
Navigate to the `backend` folder:
```bash
cd backend
```

Install backend packages:
```bash
npm install
```

Create a private `.env` file in `/backend`:
```env
PORT=5000
DATABASE_URL=your_postgresql_connection_url
JWT_SECRET=use_a_strong_random_hash_key
GROQ_API_KEY=your_groq_or_gemini_api_key
TAVILY_API_KEY=your_tavily_web_search_key
```

Run the database schema setup script:
```bash
node db_init.js
```
*This will automatically generate all tables (`users`, `chats`, `messages`, `password_resets`) in your database.*

Run the development server:
```bash
npm start
```
*The backend server will run on `http://localhost:5000`.*

---

### 3. Frontend Installation & Setup
Open a new terminal window and navigate to the `voice-assistant` client folder:
```bash
cd voice-assistant
```

Install the dependencies:
```bash
npm install
```

Create an environment configuration file `.env` in `/voice-assistant`:
```env
REACT_APP_API_URL=http://localhost:5000
```

Start the React development server:
```bash
npm start
```
*The client browser dashboard will open automatically on `http://localhost:3000`.*

---


