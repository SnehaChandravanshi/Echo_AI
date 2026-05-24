import React from 'react';

const AnimatedBackground = ({ activeMode, isDarkMode }) => {
    const getTheme = () => {
        if (!isDarkMode) {
            return {
                background: '#ffffff',
                particleColor: 'rgba(0, 0, 0, 0.05)',
                lineColorBase: 'rgba(0, 0, 0, '
            };
        }

        switch (activeMode) {
            case 'coding':
                return {
                    background: 'radial-gradient(circle at 20% -10%, #282828 0%, transparent 38%), radial-gradient(circle at 85% 110%, #1a1a1a 0%, transparent 42%), linear-gradient(150deg, #050505, #0f0f0f, #171717)',
                    particleColor: 'rgba(255, 255, 255, 0.18)',
                    lineColorBase: 'rgba(255, 255, 255, '
                };
            case 'summarization':
                return {
                    background: 'radial-gradient(circle at 15% -5%, #242424 0%, transparent 40%), linear-gradient(155deg, #060606, #111111, #1b1b1b)',
                    particleColor: 'rgba(255, 255, 255, 0.12)',
                    lineColorBase: null
                };
            case 'files':
                return {
                    background: 'radial-gradient(circle at 78% 108%, #2a2a2a 0%, transparent 44%), linear-gradient(145deg, #070707, #121212, #1c1c1c)',
                    particleColor: 'rgba(255, 255, 255, 0.14)',
                    lineColorBase: 'rgba(255, 255, 255, '
                };
            case 'chat':
            default:
                return {
                    background: 'radial-gradient(circle at 20% -8%, #262626 0%, transparent 40%), radial-gradient(circle at 80% 112%, #1e1e1e 0%, transparent 46%), linear-gradient(145deg, #060606, #121212, #1d1d1d)',
                    particleColor: 'rgba(255, 255, 255, 0.16)',
                    lineColorBase: 'rgba(255, 255, 255, '
                };
        }
    };

    const theme = getTheme();

    return (
        <div
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                zIndex: 0,
                background: theme.background,
                transition: 'background 0.4s ease-in-out',
                pointerEvents: 'none'
            }}
        />
    );
};

export default AnimatedBackground;
