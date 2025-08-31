import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api';
import '../fonts.css';
export default function Landing() {
    const navigate = useNavigate();
    const [starParticles, setStarParticles] = useState([]);
    const [backgroundStars, setBackgroundStars] = useState([]);
    const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
    // Rotating text options
    const [currentTextIndex, setCurrentTextIndex] = useState(0);
    const [showRotatingText, setShowRotatingText] = useState(true);
    const [isMobile, setIsMobile] = useState(false);
    const [showVideoModal, setShowVideoModal] = useState(false);
    const rotatingTexts = [
        "No <strong>DevOps</strong>",
        "No <strong>GitHub</strong>",
        "No finnicky <strong>envs</strong>",
        "No deployment <strong>pipelines</strong>",
        "No <strong>configs</strong>",
        "No <strong>Kubernetes</strong>"
    ];
    const handleGetStarted = () => {
        navigate('/login');
    };
    const handleSignUp = () => {
        navigate('/login?mode=signup');
    };
    const handleLogIn = () => {
        navigate('/login');
    };
    // Track page view
    useEffect(() => {
        const trackPageView = async () => {
            try {
                await api.post('/analytics/track', {
                    eventType: 'page_view',
                    eventData: { page: 'Landing Page' }
                });
            }
            catch (error) {
                console.error('Failed to track page view:', error);
            }
        };
        trackPageView();
    }, []);
    // Detect mobile device
    useEffect(() => {
        const checkMobile = () => {
            const userAgent = navigator.userAgent.toLowerCase();
            const isMobileDevice = /mobile|android|iphone|ipad|phone|tablet/i.test(userAgent) ||
                window.innerWidth <= 768;
            setIsMobile(isMobileDevice);
        };
        checkMobile();
        window.addEventListener('resize', checkMobile);
        return () => window.removeEventListener('resize', checkMobile);
    }, []);
    // Create permanent background stars
    useEffect(() => {
        const createBackgroundStars = () => {
            const stars = [];
            const numBackgroundStars = 50; // Number of permanent background stars
            for (let i = 0; i < numBackgroundStars; i++) {
                stars.push({
                    id: i,
                    x: Math.random() * window.innerWidth,
                    y: Math.random() * window.innerHeight,
                    size: Math.random() * 2 + 0.5, // 0.5-2.5 pixels
                    opacity: Math.random() * 0.6 + 0.2, // 0.2-0.8 opacity
                });
            }
            setBackgroundStars(stars);
        };
        createBackgroundStars();
        // Recreate stars on window resize
        const handleResize = () => createBackgroundStars();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);
    // Simple rotation without fading
    useEffect(() => {
        if (!showRotatingText)
            return;
        const interval = setInterval(() => {
            setCurrentTextIndex(prev => {
                const nextIndex = prev + 1;
                if (nextIndex >= rotatingTexts.length) {
                    setShowRotatingText(false);
                    clearInterval(interval);
                    return prev;
                }
                return nextIndex;
            });
        }, 1200); // Change text every 1.2 seconds
        return () => clearInterval(interval);
    }, [rotatingTexts.length]);
    // Handle mouse movement and create star particles
    useEffect(() => {
        let particleId = 0;
        let lastParticleTime = 0;
        const particleInterval = 100; // Particle frequency in milliseconds
        const handleMouseMove = (e) => {
            const now = Date.now();
            setMousePosition({ x: e.clientX, y: e.clientY });
            // Create star particles if enough time has passed
            if (now - lastParticleTime > particleInterval) {
                const numParticles = Math.floor(Math.random() * 10) + 5; // 5-15 particles
                const newParticles = [];
                for (let i = 0; i < numParticles; i++) {
                    const angle = Math.random() * 360; // 0-360 degrees
                    const distance = Math.random() * 100 + 15; // 15-115 pixels away
                    const size = Math.random() * 2 + 1; // 1-3 pixels
                    // Calculate position relative to cursor
                    const radians = (angle * Math.PI) / 180;
                    const x = e.clientX + Math.cos(radians) * distance;
                    const y = e.clientY + Math.sin(radians) * distance;
                    newParticles.push({
                        id: particleId++,
                        x,
                        y,
                        size,
                        opacity: 1,
                    });
                }
                setStarParticles(prev => [...prev, ...newParticles]);
                lastParticleTime = now;
                // Remove particles after animation
                setTimeout(() => {
                    setStarParticles(prev => prev.filter(particle => !newParticles.find(np => np.id === particle.id)));
                }, 600);
            }
        };
        window.addEventListener('mousemove', handleMouseMove);
        return () => window.removeEventListener('mousemove', handleMouseMove);
    }, []);
    return (_jsxs("div", { className: "min-h-screen bg-black relative overflow-hidden font-poppins", children: [backgroundStars.map((star) => (_jsx("div", { className: "absolute pointer-events-none z-5", style: {
                    left: star.x,
                    top: star.y,
                    transform: `translate(-50%, -50%)`,
                }, children: _jsx("div", { className: "bg-white rounded-full", style: {
                        width: `${star.size}px`,
                        height: `${star.size}px`,
                        opacity: star.opacity,
                        boxShadow: `0 0 ${star.size * 3}px ${star.size}px rgba(255, 255, 255, 0.2)`,
                    } }) }, star.id))), starParticles.map((particle) => (_jsx("div", { className: "absolute pointer-events-none z-10", style: {
                    left: particle.x,
                    top: particle.y,
                    transform: `translate(-50%, -50%)`,
                }, children: _jsx("div", { className: "bg-white rounded-full animate-pulse", style: {
                        width: `${particle.size}px`,
                        height: `${particle.size}px`,
                        opacity: particle.opacity,
                        boxShadow: `0 0 ${particle.size * 2}px ${particle.size}px rgba(255, 255, 255, 0.3)`,
                    } }) }, particle.id))), _jsx("header", { className: "bg-black/95 backdrop-blur-sm border-b border-gray-800 sticky top-0 z-50 shadow-sm", children: _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: _jsxs("div", { className: "flex justify-between items-center h-16", children: [_jsx("div", { className: "flex items-center", children: _jsx("h1", { className: "text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent font-share-tech-mono", children: "QuickStage" }) }), _jsxs("nav", { className: "flex items-center space-x-2 sm:space-x-6", children: [_jsx("button", { onClick: handleSignUp, className: "text-gray-300 hover:text-blue-400 px-2 sm:px-3 py-2 text-sm font-medium transition-colors duration-200 font-poppins", children: "Sign Up" }), _jsx("button", { onClick: handleLogIn, className: "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-medium py-2 px-4 sm:px-6 rounded-lg transition-all duration-200 transform hover:scale-105 shadow-md hover:shadow-lg font-poppins", children: "Log In" })] })] }) }) }), _jsxs("section", { className: "relative bg-gradient-to-br from-black via-gray-900 to-black min-h-screen flex items-center justify-center overflow-hidden", children: [_jsxs("div", { className: "absolute inset-0 overflow-hidden", children: [_jsx("div", { className: "absolute -top-40 -right-40 w-80 h-80 bg-blue-500/10 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" }), _jsx("div", { className: "absolute -bottom-40 -left-40 w-80 h-80 bg-purple-500/10 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse" })] }), _jsx("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center relative z-10", children: _jsxs("div", { className: "max-w-4xl mx-auto", children: [_jsxs("h1", { className: "text-5xl md:text-7xl font-bold text-white mb-8 leading-tight font-inconsolata", children: ["Share Working", _jsx("span", { className: "text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400", children: " Prototypes" }), _jsx("br", {}), "in One Click"] }), showRotatingText && (_jsx("p", { className: "text-xl md:text-2xl text-gray-300 mb-2 leading-relaxed", dangerouslySetInnerHTML: { __html: rotatingTexts[currentTextIndex] || "" } })), _jsx("p", { className: "text-xl md:text-2xl text-gray-300 mb-10 leading-relaxed", children: "Just your prototype, online in seconds." }), _jsxs("div", { className: "flex flex-col sm:flex-row gap-6 justify-center", children: [_jsx("button", { onClick: handleGetStarted, className: "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 px-10 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl font-poppins", children: "Start Staging Free" }), _jsxs("button", { onClick: () => setShowVideoModal(true), className: "border-1 border-gray-600 hover:border-gray-500 text-gray-100 font-semibold py-4 px-10 rounded-xl text-lg transition-all duration-300 bg-gray-800/50 hover:bg-gray-700/50 shadow-lg hover:shadow-xl backdrop-blur-sm font-poppins flex items-center justify-center gap-3", children: [_jsx("svg", { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z", clipRule: "evenodd" }) }), "Quick Video Explainer"] })] })] }) })] }), _jsx("section", { id: "how-it-works", className: "py-32 bg-gradient-to-b from-black/80 to-gray-900/80", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-20", children: [_jsx("h2", { className: "text-5xl md:text-6xl font-bold text-white mb-6 font-inconsolata", children: "How QuickStage Works" }), _jsxs("button", { onClick: () => setShowVideoModal(true), className: "text-xl text-gray-300 hover:text-blue-400 transition-colors duration-200 flex items-center justify-center gap-2 mx-auto font-poppins mb-4", children: [_jsx("svg", { className: "w-5 h-5", fill: "currentColor", viewBox: "0 0 20 20", children: _jsx("path", { fillRule: "evenodd", d: "M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z", clipRule: "evenodd" }) }), "Quick Video Explainer"] }), _jsx("p", { className: "text-lg text-gray-400 max-w-2xl mx-auto font-poppins", children: "Three quick steps to a shareable prototype" })] }), _jsxs("div", { className: "grid md:grid-cols-3 gap-12", children: [_jsxs("div", { className: "text-center group", children: [_jsx("div", { className: "bg-gradient-to-br from-blue-500 to-blue-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110", children: _jsx("span", { className: "text-3xl font-bold text-white", children: "1" }) }), _jsx("h3", { className: "text-3xl font-semibold text-white mb-4 font-inconsolata", children: "Build Locally" }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "Turn your ideas for a new feature or product into a quick prototype \u2013 let your favorite AI agent help!" })] }), _jsxs("div", { className: "text-center group", children: [_jsx("div", { className: "bg-gradient-to-br from-purple-500 to-purple-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110", children: _jsx("span", { className: "text-3xl font-bold text-white", children: "2" }) }), _jsx("h3", { className: "text-3xl font-semibold text-white mb-4 font-inconsolata", children: "Deploy Instantly" }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "QuickStage adapts to the framework you've used and deploys the project to the web in seconds." })] }), _jsxs("div", { className: "text-center group", children: [_jsx("div", { className: "bg-gradient-to-br from-indigo-500 to-indigo-600 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg group-hover:shadow-xl transition-all duration-300 transform group-hover:scale-110", children: _jsx("span", { className: "text-3xl font-bold text-white", children: "3" }) }), _jsx("h3", { className: "text-3xl font-semibold text-white mb-4 font-inconsolata", children: "Share Securely" }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "Get a private, password-protected URL to share with your team for comments and input." })] })] })] }) }), _jsx("section", { id: "features", className: "py-32 bg-gradient-to-b from-gray-900/80 to-black/80", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "text-center mb-20", children: [_jsx("h2", { className: "text-5xl md:text-6xl font-bold text-white mb-6 font-inconsolata", children: "Built for Modern Development" }), _jsx("p", { className: "text-xl text-gray-300 max-w-2xl mx-auto font-poppins", children: "Everything you need to get your prototypes online quickly and securely" })] }), _jsxs("div", { className: "grid md:grid-cols-2 lg:grid-cols-3 gap-8", children: [_jsxs("div", { className: "bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700/50", children: [_jsxs("div", { className: "flex items-center mb-6", children: [_jsx("div", { className: "w-14 h-14 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-md", children: _jsx("svg", { className: "w-7 h-7 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M13 10V3L4 14h7v7l9-11h-7z" }) }) }), _jsx("h3", { className: "text-2xl font-semibold text-white font-inconsolata", children: "10-Second Deploys" })] }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "Deploy your first prototype in less than 10 seconds. No env management, no CI/CD, no managing environments or deconflicting repos with the development team." })] }), _jsxs("div", { className: "bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700/50", children: [_jsxs("div", { className: "flex items-center mb-6", children: [_jsx("div", { className: "w-14 h-14 bg-gradient-to-br from-green-500 to-green-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-md", children: _jsx("svg", { className: "w-7 h-7 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" }) }) }), _jsx("h3", { className: "text-2xl font-semibold text-white font-inconsolata", children: "Secure by Default" })] }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "Password-protected sharing, private by default. No public exposure of your work-in-progress." })] }), _jsxs("div", { className: "bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700/50", children: [_jsxs("div", { className: "flex items-center mb-6", children: [_jsx("div", { className: "w-14 h-14 bg-gradient-to-br from-purple-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-md", children: _jsx("svg", { className: "w-7 h-7 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M8 12h.01M12 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" }) }) }), _jsx("h3", { className: "text-2xl font-semibold text-white font-inconsolata", children: "Real-time Comments" })] }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "Get feedback directly on your prototypes with inline comments and real-time collaboration." })] }), _jsxs("div", { className: "bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700/50", children: [_jsxs("div", { className: "flex items-center mb-6", children: [_jsx("div", { className: "w-14 h-14 bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-md", children: _jsx("svg", { className: "w-7 h-7 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" }) }) }), _jsx("h3", { className: "text-2xl font-semibold text-white font-inconsolata", children: "Framework Agnostic" })] }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "Works with React, Vue, Svelte, Next.js, and more. Detects your build system automatically." })] }), _jsxs("div", { className: "bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700/50", children: [_jsxs("div", { className: "flex items-center mb-6", children: [_jsx("div", { className: "w-14 h-14 bg-gradient-to-br from-orange-500 to-purple-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-md", children: _jsx("svg", { className: "w-7 h-7 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" }) }) }), _jsx("h3", { className: "text-2xl font-semibold text-white font-inconsolata", children: "No Setup, No Config" })] }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "Install the extension in Cursor or VS Code and you're ready to go. Stage your first prototype less than 30 seconds after downloading the extension." })] }), _jsxs("div", { className: "bg-gray-800/50 backdrop-blur-sm p-8 rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 transform hover:-translate-y-1 border border-gray-700/50", children: [_jsxs("div", { className: "flex items-center mb-6", children: [_jsx("div", { className: "w-14 h-14 bg-gradient-to-br from-pink-500 to-pink-600 rounded-xl flex items-center justify-center mr-4 flex-shrink-0 shadow-md", children: _jsx("svg", { className: "w-7 h-7 text-white", fill: "none", stroke: "currentColor", viewBox: "0 0 24 24", children: _jsx("path", { strokeLinecap: "round", strokeLinejoin: "round", strokeWidth: 2, d: "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" }) }) }), _jsx("h3", { className: "text-2xl font-semibold text-white font-inconsolata", children: "Ship Ideas, Not PRDs" })] }), _jsx("p", { className: "text-gray-300 leading-relaxed font-poppins", children: "Ditch the 10-page requirements docs. If a picture is worth a thousand words, what's a working prototype worth?" })] })] })] }) }), _jsxs("section", { className: "py-24 bg-gradient-to-br from-black via-blue-900/20 to-purple-900/20 relative overflow-hidden", children: [_jsxs("div", { className: "absolute inset-0 overflow-hidden", children: [_jsx("div", { className: "absolute top-0 left-0 w-full h-full bg-gradient-to-br from-blue-500/10 via-transparent to-purple-500/10" }), _jsx("div", { className: "absolute -top-20 -right-20 w-40 h-40 bg-blue-500/20 rounded-full filter blur-3xl" }), _jsx("div", { className: "absolute -bottom-20 -left-20 w-40 h-40 bg-purple-500/20 rounded-full filter blur-3xl" })] }), _jsxs("div", { className: "max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8 relative z-10", children: [_jsx("h2", { className: "text-4xl md:text-5xl font-bold text-white mb-6 font-inconsolata", children: "Ready to Stage Your First Prototype?" }), _jsx("p", { className: "text-xl text-gray-300 mb-10 leading-relaxed font-poppins", children: "Join dozens of designers, product managers, and developers who are already using QuickStage to shortcut the product development process." }), _jsx("button", { onClick: handleGetStarted, className: "bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold py-4 px-10 rounded-xl text-lg transition-all duration-300 transform hover:scale-105 shadow-xl hover:shadow-2xl font-poppins", children: "Start Staging Free" })] })] }), showVideoModal && (_jsx("div", { className: "fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-4", children: _jsxs("div", { className: "relative max-w-4xl w-full", children: [_jsx("button", { onClick: () => setShowVideoModal(false), className: "absolute -top-12 right-0 text-white hover:text-gray-300 text-xl font-bold z-10 bg-black/50 rounded-full w-10 h-10 flex items-center justify-center transition-colors duration-200", children: "\u2715" }), _jsx("div", { className: "relative bg-black rounded-lg overflow-hidden shadow-2xl", style: { paddingBottom: '56.25%' }, children: _jsx("iframe", { src: "https://player.vimeo.com/video/1114461563?badge=0&autopause=0&player_id=0&app_id=58479&autoplay=1&dnt=1", frameBorder: "0", allow: "autoplay; fullscreen; picture-in-picture; clipboard-write; encrypted-media; web-share", referrerPolicy: "strict-origin-when-cross-origin", style: { position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }, title: "QuickStage - Shortcut the development cycle" }) })] }) })), _jsx("footer", { className: "bg-black text-white py-12 font-poppins", children: _jsxs("div", { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8", children: [_jsxs("div", { className: "grid md:grid-cols-4 gap-8", children: [_jsxs("div", { children: [_jsx("h3", { className: "text-lg font-semibold mb-4", children: "QuickStage" }), _jsx("p", { className: "text-gray-400 text-sm", children: "The fastest way to stage and share your product prototypes." })] }), _jsxs("div", { children: [_jsx("h4", { className: "text-sm font-semibold text-gray-400 uppercase tracking-wider mb-4", children: "Product" }), _jsxs("ul", { className: "space-y-2 text-sm", children: [_jsx("li", { children: _jsx("a", { href: "#how-it-works", className: "text-gray-300 hover:text-white", children: "How It Works" }) }), _jsx("li", { children: _jsx("a", { href: "#features", className: "text-gray-300 hover:text-white", children: "Features" }) }), _jsx("li", { children: _jsx("a", { href: "/pricing", className: "text-gray-300 hover:text-white", children: "Pricing" }) }), _jsx("li", { children: _jsx("a", { href: "mailto:support@quickstage.tech", className: "text-gray-300 hover:text-white", children: "Contact" }) })] })] })] }), _jsx("div", { className: "border-t border-gray-800 mt-8 pt-8 text-center", children: _jsx("p", { className: "text-gray-400 text-sm", children: "\u00A9 2025 QuickStage. All rights reserved." }) })] }) })] }));
}
