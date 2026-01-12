import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquare, 
  Activity, 
  Settings, 
  Send, 
  Key, 
  Server, 
  Cpu, 
  Trash2,
  Lock,
  ChevronRight,
  AlertTriangle,
  Terminal,
  Play,
  Check,
  XCircle,
  Link as LinkIcon,
  Copy,
  Loader2,
  ChevronDown,
  ChevronUp,
  Code,
  Zap,
  Search,
  ShieldAlert
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

import { AppView, Message, GROQ_MODELS, ApiStatusMetric, TermuxConfig } from './types';
import { chatWithGroq, checkGroqStatus } from './services/groqService';
import { IOSButton, IOSCard, IOSInput, IOSSegmentedControl } from './components/IOSComponents';

// --- Mock Data for Charts ---
const generateChartData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    time: `${i}s`,
    latency: Math.floor(Math.random() * 200) + 100, // 100-300ms
  }));
};

const formatModelName = (modelId: string) => {
  if (modelId.includes('70b')) return 'Llama 3.3 70B';
  if (modelId.includes('8b')) return 'Llama 3.1 8B';
  return modelId;
};

// --- Termux System Instruction (SMART SEARCH & DESTROY) ---
const TERMUX_SYSTEM_PROMPT = `
You are **Groq-OS**, an advanced AI Shell Assistant for Termux.

**CORE BEHAVIORS:**

1.  **PROTOCOL (Explanation vs. Action):**
    *   **User asks "How to...":** Explain concepts. Do NOT generate a run-able command block yet.
    *   **User says "Run/Yes":** Generate the command block.

2.  **COMMAND FORMAT:**
    *   Wrap executable commands EXACTLY like this:
    <<<CMD: your_command_here >>>

3.  **SMART DELETION PROTOCOL (CRITICAL):**
    *   **NEVER GUESS:** If user says "delete createdbykztutorial" (inexact name), **DO NOT** generate \`rm\` immediately.
    *   **STEP 1 (SEARCH):** Generate a search command first to find the exact filename.
        <<<CMD: find . -maxdepth 2 -iname "*createdbykztutorial*" >>>
    *   **STEP 2 (ANALYZE):** Wait for the system output.
    *   **STEP 3 (CONFIRM):** The system will show you the result (e.g., "./CREATED_BY_Kz.tutorial"). You must say: "I found this file: 'CREATED_BY_Kz.tutorial'. Shall I delete it?"
    *   **STEP 4 (DESTROY):** Only after user confirms, generate the delete command for the **EXACT** file found.
        <<<CMD: rm -rf "CREATED_BY_Kz.tutorial" >>>

4.  **POST-EXECUTION ANALYSIS:**
    *   Summarize command outputs briefly in natural language.
    *   If output is "git version 2.x", say "Git is installed (v2.x)."

5.  **PERSONALITY:**
    *   High-tech, precise, "Cyber" aesthetic.
    *   Keep responses concise.
`;

const App = () => {
  // State
  const [apiKey, setApiKey] = useState<string>('');
  const [tempKey, setTempKey] = useState<string>('');
  const [isKeyValid, setIsKeyValid] = useState<boolean>(false);
  const [hasCheckedKey, setHasCheckedKey] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  const [showRateLimitModal, setShowRateLimitModal] = useState<boolean>(false);
  const [newRateLimitKey, setNewRateLimitKey] = useState<string>('');
  
  // Termux State
  const [termuxConfig, setTermuxConfig] = useState<TermuxConfig>({ url: '', token: '12345', isConnected: false });
  
  // --- Smart Execution State ---
  const [activeCmdId, setActiveCmdId] = useState<string | null>(null);
  const [executionStep, setExecutionStep] = useState<string>('');
  const [cmdResults, setCmdResults] = useState<Record<string, { success: boolean, output: string, timestamp: string }>>({});
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: TERMUX_SYSTEM_PROMPT }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(GROQ_MODELS[0]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Status State
  const [metrics, setMetrics] = useState<ApiStatusMetric[]>([
    { endpoint: '/api/v1/chat/completions', method: 'POST', status: 'Operational', latency: 145, lastChecked: 'Just now' },
    { endpoint: '/api/v1/models', method: 'GET', status: 'Operational', latency: 98, lastChecked: 'Just now' },
    { endpoint: '/api/v1/audio/transcriptions', method: 'POST', status: 'Degraded', latency: 450, lastChecked: '1m ago' },
  ]);

  useEffect(() => {
    const storedKey = localStorage.getItem('groq_api_key');
    if (storedKey) {
      setApiKey(storedKey);
      verifyKey(storedKey);
    } else {
      setHasCheckedKey(true);
    }
    
    // Load Termux Config
    const storedTermux = localStorage.getItem('termux_config');
    if (storedTermux) {
        setTermuxConfig(JSON.parse(storedTermux));
    }
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, activeCmdId, cmdResults, isLoading]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const verifyKey = async (key: string) => {
    setIsLoading(true);
    const valid = await checkGroqStatus(key);
    setIsKeyValid(valid);
    setHasCheckedKey(true);
    setIsLoading(false);
    if (valid) {
      localStorage.setItem('groq_api_key', key);
    }
    return valid;
  };

  const handleSaveKey = () => {
    if (tempKey.startsWith('gsk_')) {
      setApiKey(tempKey);
      verifyKey(tempKey);
    } else {
      alert('Invalid Groq API Key format. It should start with "gsk_".');
    }
  };

  const handleUpdateRateLimitKey = async () => {
    if (!newRateLimitKey.startsWith('gsk_')) {
      alert('Invalid Groq API Key format.');
      return;
    }
    setIsLoading(true);
    const valid = await checkGroqStatus(newRateLimitKey);
    setIsLoading(false);

    if (valid) {
      setApiKey(newRateLimitKey);
      localStorage.setItem('groq_api_key', newRateLimitKey);
      setNewRateLimitKey('');
      setShowRateLimitModal(false);
      setMessages(prev => prev.filter(msg => !msg.content.includes("Rate limit exceeded")));
    } else {
      alert('The API Key provided is invalid. Please check and try again.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('groq_api_key');
    setApiKey('');
    setTempKey('');
    setIsKeyValid(false);
    setMessages([{ role: 'system', content: TERMUX_SYSTEM_PROMPT }]);
  };

  const handleClearChat = () => {
      setMessages([{ role: 'system', content: TERMUX_SYSTEM_PROMPT }]);
      setCmdResults({});
  };

  // --- Termux Logic (Smart Version) ---

  const saveTermuxConfig = async () => {
      let url = termuxConfig.url.trim();
      if (url.endsWith('/')) url = url.slice(0, -1);
      
      const newConfig = { ...termuxConfig, url };
      
      try {
          const res = await fetch(`${url}/`, { 
              method: 'GET',
              headers: {
                  'Cache-Control': 'no-cache',
                  'ngrok-skip-browser-warning': 'true',
                  'Bypass-Tunnel-Reminder': 'true'
              }
          });
          
          if (res.ok) {
              const data = await res.json();
              if (data.status === 'online') {
                  const finalConfig = { ...newConfig, isConnected: true };
                  setTermuxConfig(finalConfig);
                  localStorage.setItem('termux_config', JSON.stringify(finalConfig));
                  alert('Termux Connected Successfully!');
              }
          } else {
              throw new Error(`Server Error (Status: ${res.status}). Ensure Python script is running.`);
          }
      } catch (e: any) {
          setTermuxConfig({ ...newConfig, isConnected: false });
          alert(`Failed to connect: ${e.message}\n\nTroubleshooting:\n1. Update Python script to V8.\n2. Ensure you copied the FULL https URL.\n3. Try restarting the Python script.`);
      }
  };

  const executeTermuxCommandSmart = async (cmd: string, cmdId: string) => {
      if (!termuxConfig.isConnected || !termuxConfig.url) {
          alert('Termux is not connected. Go to Settings/Termux to configure.');
          return;
      }

      setActiveCmdId(cmdId);
      
      // COOL CYBER SEQUENCE
      const steps = [
          'INITIALIZING UPLINK...', 
          'SCANNING FILESYSTEM...', 
          'TARGET ACQUIRED...', 
          'EXECUTING PAYLOAD...'
      ];
      
      // Simulate steps with delays
      for (const step of steps) {
          setExecutionStep(step);
          await new Promise(resolve => setTimeout(resolve, 400)); 
      }

      try {
          const res = await fetch(`${termuxConfig.url}/execute`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Auth-Token': termuxConfig.token,
                  'ngrok-skip-browser-warning': 'true'
              },
              body: JSON.stringify({ command: cmd })
          });
          
          const data = await res.json();
          const output = data.stdout || data.stderr || "Command executed successfully (No Output).";
          
          setCmdResults(prev => ({
              ...prev,
              [cmdId]: { 
                  success: res.ok, 
                  output: output,
                  timestamp: new Date().toLocaleTimeString()
              }
          }));

          // --- SMART AI FOLLOW UP ---
          if (res.ok) {
              await handleAiFollowUp(cmd, output);
          }

      } catch (e: any) {
          setCmdResults(prev => ({
                 ...prev,
                 [cmdId]: { 
                     success: false, 
                     output: `Network/Script Error: ${e.message}`,
                     timestamp: new Date().toLocaleTimeString()
                 }
             }));
      } finally {
          setActiveCmdId(null);
          setExecutionStep('');
      }
  };

  const handleAiFollowUp = async (cmd: string, output: string) => {
      setIsLoading(true);
      const systemResultMsg: Message = { 
          role: 'system', 
          content: `[SYSTEM OUTPUT for command '${cmd}']: ${output}\n\nAnalyze this output. If it was a search, tell the user what was found and ask to confirm action. If it was an action, summarize success.` 
      };
      
      const newHistory = [...messages, systemResultMsg];
      
      try {
          const response = await chatWithGroq(newHistory, apiKey, selectedModel);
          const assistantMsg = response.choices[0].message;
          setMessages(prev => [...prev, assistantMsg]);
      } catch (e) {
          console.error("AI Follow up failed", e);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !apiKey) return;

    // Pass context about Termux connection state
    const contextMsg = termuxConfig.isConnected 
        ? `[System Note: Termux is CONNECTED. You can generate commands.]`
        : `[System Note: Termux is NOT connected. Do not generate commands yet.]`;
    
    const userMsg: Message = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const msgsToSend: Message[] = [...messages, { role: 'system', content: contextMsg }, userMsg];
      const response = await chatWithGroq(msgsToSend, apiKey, selectedModel);
      const assistantMsg = response.choices[0].message;
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      if (error.message === 'GROQ_RATE_LIMIT_EXCEEDED') {
        setShowRateLimitModal(true);
        setMessages(prev => [...prev, { role: 'system', content: '⚠️ Rate limit exceeded. Waiting for new key...' }]);
      } else {
        setMessages(prev => [...prev, { role: 'system', content: `Error: ${error.message}` }]);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // --- Message Renderer with ULTRA COOL Terminal ---
  const renderMessageContent = (content: string, msgIndex: number, role: 'user' | 'assistant' | 'system') => {
      const cmdRegex = /<<<CMD:(.*?)>>>/g;
      const parts = content.split(cmdRegex);
      
      if (parts.length === 1) {
          return (
             <div className={`markdown-body prose ${role === 'user' ? 'user-msg text-white' : 'text-gray-800'}`}>
                 <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
             </div>
          );
      }

      return (
          <div className="w-full">
              {parts.map((part, i) => {
                  if (i % 2 === 0) {
                      if (!part.trim()) return null;
                      return (
                          <div key={i} className={`markdown-body prose mb-2 ${role === 'user' ? 'user-msg text-white' : 'text-gray-800'}`}>
                             <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
                          </div>
                      );
                  }
                  
                  // Command Block
                  const cmd = part.trim();
                  const cmdId = `cmd-${msgIndex}-${i}`;
                  const isRunning = activeCmdId === cmdId;
                  const result = cmdResults[cmdId];

                  // --- COOL ANIMATED TERMINAL ---
                  return (
                      <div key={cmdId} className={`my-3 rounded-lg overflow-hidden border transition-all duration-300 ${isRunning ? 'border-green-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]' : 'border-gray-200 bg-white shadow-sm'} w-full font-mono text-sm`}>
                          
                          {/* Running State Overlay */}
                          {isRunning ? (
                             <div className="bg-black text-green-400 p-4 relative overflow-hidden">
                                 {/* Scanning Line Animation */}
                                 <div className="absolute top-0 left-0 w-full h-full bg-[linear-gradient(transparent_0%,rgba(34,197,94,0.1)_50%,transparent_100%)] animate-[scan_2s_linear_infinite] pointer-events-none"></div>
                                 
                                 <div className="flex justify-between items-center mb-2 z-10 relative">
                                     <div className="flex items-center gap-2">
                                         <Loader2 size={16} className="animate-spin" />
                                         <span className="font-bold tracking-widest text-xs">GROQ_OS::EXEC</span>
                                     </div>
                                     <span className="text-[10px] bg-green-900/40 px-2 py-0.5 rounded border border-green-800">PID: {Math.floor(Math.random() * 9000) + 1000}</span>
                                 </div>

                                 <div className="font-mono text-xs space-y-1 z-10 relative opacity-90">
                                     <div className="flex gap-2">
                                         <span className="text-gray-500">$</span>
                                         <span className="text-white">{cmd}</span>
                                     </div>
                                     <div className="text-green-500 mt-2 font-bold flex items-center gap-2">
                                         <ChevronRight size={14} />
                                         {executionStep}
                                         <span className="animate-pulse">_</span>
                                     </div>
                                 </div>
                             </div>
                          ) : (
                             // Idle / Result State
                             <div className="flex flex-col">
                                 <div className="flex items-stretch bg-gray-50">
                                     <div className="bg-gray-800 text-gray-400 px-3 py-3 flex items-center select-none text-xs">
                                         TERMUX
                                     </div>
                                     <div className="flex-1 px-3 py-3 overflow-x-auto whitespace-nowrap flex items-center text-gray-700 font-medium">
                                         <span className="text-blue-500 mr-2">$</span> {cmd}
                                     </div>
                                     
                                     <div className="border-l border-gray-200">
                                         {result ? (
                                              <div className={`h-full px-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider ${result.success ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                                                  {result.success ? <Check size={16} /> : <XCircle size={16} />}
                                                  {result.success ? 'DONE' : 'ERR'}
                                              </div>
                                         ) : (
                                              <button 
                                                  onClick={() => executeTermuxCommandSmart(cmd, cmdId)}
                                                  disabled={!termuxConfig.isConnected}
                                                  className={`h-full px-5 flex items-center gap-2 transition-colors font-bold tracking-wider text-[11px] uppercase
                                                    ${termuxConfig.isConnected 
                                                        ? 'bg-blue-600 text-white hover:bg-blue-700 active:bg-blue-800 hover:shadow-lg' 
                                                        : 'bg-gray-200 text-gray-400 cursor-not-allowed'}
                                                  `}
                                              >
                                                  <Play size={12} fill="currentColor" />
                                                  EXECUTE
                                              </button>
                                         )}
                                     </div>
                                 </div>
                                 
                                 {/* Only show raw error output. Success output handled by AI summary */}
                                 {result && !result.success && (
                                     <div className="bg-gray-900 text-red-400 p-2 text-xs font-mono border-t border-gray-800">
                                         {result.output}
                                     </div>
                                 )}
                             </div>
                          )}
                      </div>
                  );
              })}
          </div>
      );
  };

  // --- Views ---

  const renderLogin = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-ios-bg/90 backdrop-blur-sm">
      <IOSCard className="w-full max-w-md p-8 flex flex-col gap-6 animate-fade-in-up">
        <div className="text-center">
          <div className="w-16 h-16 bg-ios-blue/10 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Key className="w-8 h-8 text-ios-blue" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Welcome to Groq iOS</h2>
          <p className="text-gray-500 mt-2">Enter your Groq API key to start.</p>
        </div>
        
        <div className="space-y-4">
          <IOSInput 
            placeholder="gsk_..." 
            value={tempKey} 
            onChange={(e) => setTempKey(e.target.value)} 
            type="password"
            label="API Key"
          />
          <IOSButton onClick={handleSaveKey} fullWidth disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Access App'}
          </IOSButton>
        </div>
      </IOSCard>
    </div>
  );

  const renderRateLimitModal = () => (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-6 bg-black/40 backdrop-blur-md">
      <div className="bg-white/95 backdrop-blur-xl w-full max-w-xs rounded-[20px] shadow-2xl p-6 text-center animate-fade-in-up">
        <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
           <AlertTriangle className="w-6 h-6 text-red-500" />
        </div>
        <h3 className="text-lg font-bold text-gray-900 mb-2">Limit Reached</h3>
        <p className="text-[15px] text-gray-500 leading-relaxed mb-6">
          Your free API key has reached its usage limit.
        </p>
        <div className="space-y-3">
          <IOSInput 
            placeholder="New API Key (gsk_...)" 
            value={newRateLimitKey} 
            onChange={(e) => setNewRateLimitKey(e.target.value)} 
            type="password"
          />
          <IOSButton onClick={handleUpdateRateLimitKey} fullWidth disabled={isLoading}>Update Key</IOSButton>
          <IOSButton variant="ghost" onClick={() => setShowRateLimitModal(false)} fullWidth>Cancel</IOSButton>
        </div>
      </div>
    </div>
  );

  const renderWelcomeScreen = () => (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 opacity-60">
          <div className="w-20 h-20 bg-gray-200 rounded-3xl flex items-center justify-center mb-6 shadow-sm">
              <Code size={40} className="text-gray-500" />
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Groq-OS Shell</h2>
          <p className="text-sm text-gray-500 max-w-xs mb-8">
              Advanced AI Assistant for Termux.<br/>Capable of file management, system analysis, and script execution.
          </p>
          <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
              <button onClick={() => setInputMessage("Check Termux version")} className="bg-white p-3 rounded-xl shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Check System
              </button>
              <button onClick={() => setInputMessage("List files in current folder")} className="bg-white p-3 rounded-xl shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  List Files
              </button>
              <button onClick={() => setInputMessage("Create a hello world python script")} className="bg-white p-3 rounded-xl shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Create Script
              </button>
              <button onClick={() => setInputMessage("How to install git?")} className="bg-white p-3 rounded-xl shadow-sm text-xs font-medium text-gray-600 hover:bg-gray-50 transition-colors">
                  Install Help
              </button>
          </div>
      </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none p-4 pb-2 bg-ios-bg/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold">Groq-OS</h1>
            <div className="flex gap-2">
                 {termuxConfig.isConnected && (
                     <div className="bg-green-100 text-green-700 px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                         <Zap size={12} fill="currentColor" />
                         ONLINE
                     </div>
                 )}
                <IOSButton variant="ghost" className="!p-2 text-gray-500 hover:text-red-500" onClick={handleClearChat}>
                    <Trash2 className="w-5 h-5" />
                </IOSButton>
            </div>
        </div>
        <IOSSegmentedControl 
          options={GROQ_MODELS.map(m => ({ label: formatModelName(m), value: m }))}
          value={selectedModel}
          onChange={setSelectedModel}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.length <= 1 ? renderWelcomeScreen() : (
            messages.filter(m => m.role !== 'system' || m.content.startsWith('[SYSTEM OUTPUT')).map((msg, idx) => {
                // Hide system output messages from view, AI reads them silently
                if (msg.role === 'system' && msg.content.startsWith('[SYSTEM OUTPUT')) return null;

                return (
                    <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-fade-in-up`}>
                        <div className={`
                        max-w-[95%] md:max-w-[85%] p-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm overflow-hidden
                        ${msg.role === 'user' 
                            ? 'bg-ios-blue text-white rounded-tr-sm' 
                            : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'}
                        `}>
                        {renderMessageContent(msg.content, idx, msg.role)}
                        </div>
                    </div>
                );
            })
        )}
        {isLoading && (
            <div className="flex justify-start">
                 <div className="bg-white p-4 rounded-2xl rounded-tl-sm border border-gray-100 shadow-sm flex gap-1">
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></span>
                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.4s'}}></span>
                 </div>
            </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex-none p-4 bg-white border-t border-gray-200 safe-area-bottom">
        <div className="flex gap-2 items-end max-w-4xl mx-auto">
          <textarea
            className="flex-1 bg-gray-100 rounded-2xl px-4 py-3 max-h-32 min-h-[44px] resize-none focus:outline-none focus:ring-2 focus:ring-ios-blue/20"
            placeholder={termuxConfig.isConnected ? "Command me..." : "Ask me..."}
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            rows={1}
          />
          <button 
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className="w-11 h-11 flex items-center justify-center bg-ios-blue text-white rounded-full shadow-lg hover:bg-blue-600 disabled:opacity-50 disabled:shadow-none transition-all"
          >
            <Send className="w-5 h-5 ml-0.5" />
          </button>
        </div>
      </div>
    </div>
  );

  const renderTermuxConfig = () => (
      <div className="p-4 h-full overflow-y-auto">
          <h1 className="text-2xl font-bold mb-2">Termux Connection</h1>
          <p className="text-gray-500 mb-6 text-sm">
              Connect Termux with SSH. Now supports Vercel (CORS Fixed V8).
          </p>

          <IOSCard className="space-y-4 mb-6">
              <div className="flex items-center gap-3 pb-4 border-b border-gray-100">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${termuxConfig.isConnected ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-500'}`}>
                      <Terminal size={24} />
                  </div>
                  <div>
                      <h3 className="font-semibold text-gray-900">Connection Status</h3>
                      <p className={`text-sm ${termuxConfig.isConnected ? 'text-green-600 font-medium' : 'text-gray-400'}`}>
                          {termuxConfig.isConnected ? 'Connected & Ready' : 'Disconnected'}
                      </p>
                  </div>
              </div>

              <div className="space-y-4">
                  <IOSInput 
                      label="Public SSH URL (from script)"
                      placeholder="https://xxxx.lhr.life"
                      value={termuxConfig.url}
                      onChange={(e) => setTermuxConfig({...termuxConfig, url: e.target.value})}
                  />
                  <IOSInput 
                      label="Access Token (Default: 12345)"
                      placeholder="12345"
                      type="password"
                      value={termuxConfig.token}
                      onChange={(e) => setTermuxConfig({...termuxConfig, token: e.target.value})}
                  />
                  <IOSButton onClick={saveTermuxConfig}>
                      {termuxConfig.isConnected ? 'Update Connection' : 'Connect'}
                  </IOSButton>
              </div>
          </IOSCard>

          <IOSCard>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <LinkIcon size={16} /> Connection Steps (V8)
              </h3>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li>In Termux: <code className="bg-gray-100 px-1 rounded">pkg install python openssh</code></li>
                  <li>Install Flask: <code className="bg-gray-100 px-1 rounded">pip install flask</code></li>
                  <li>
                    <b>CRITICAL:</b> Update the script to V8 below.
                  </li>
                  <li>Run script. Copy URL ending in <b>.lhr.life</b>.</li>
                  <li>Default Token is <b>12345</b>.</li>
              </ol>
          </IOSCard>
      </div>
  );

  const renderApiStatus = () => (
    <div className="p-4 space-y-6 overflow-y-auto h-full pb-24">
      {/* Existing API Status Code... keeping it same but abbreviated for this update */}
      <div className="flex justify-between items-center mb-2">
        <h1 className="text-2xl font-bold">API Status</h1>
        <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold">
           <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </span>
          All Systems Operational
        </div>
      </div>
       {/* Real-time Latency Chart */}
       <IOSCard className="h-64 flex flex-col">
        <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-700 flex items-center gap-2">
                <Activity className="w-5 h-5 text-ios-blue" />
                Response Latency
            </h3>
            <span className="text-xs text-gray-400">Live (ms)</span>
        </div>
        <div className="flex-1 w-full -ml-4">
            <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={generateChartData()}>
                <defs>
                <linearGradient id="colorLatency" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#007AFF" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#007AFF" stopOpacity={0}/>
                </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="time" hide />
                <YAxis tick={{fontSize: 10, fill: '#999'}} axisLine={false} tickLine={false} />
                <Tooltip 
                    contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)'}}
                />
                <Area type="monotone" dataKey="latency" stroke="#007AFF" strokeWidth={2} fillOpacity={1} fill="url(#colorLatency)" />
            </AreaChart>
            </ResponsiveContainer>
        </div>
      </IOSCard>
      {/* Endpoints List */}
      <h3 className="font-semibold text-gray-500 text-sm uppercase tracking-wider ml-1">Public Endpoints</h3>
      <div className="space-y-3">
        {metrics.map((metric, i) => (
            <IOSCard key={i} className="flex items-center justify-between !py-3">
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${metric.method === 'POST' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'} font-bold text-xs`}>
                        {metric.method}
                    </div>
                    <div>
                        <div className="font-mono text-sm text-gray-800">{metric.endpoint}</div>
                        <div className="text-xs text-gray-400">Last checked: {metric.lastChecked}</div>
                    </div>
                </div>
                <div className="flex flex-col items-end">
                    <span className={`text-sm font-semibold ${
                        metric.status === 'Operational' ? 'text-green-600' : 
                        metric.status === 'Degraded' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                        {metric.status}
                    </span>
                    <span className="text-xs text-gray-400">{metric.latency}ms</span>
                </div>
            </IOSCard>
        ))}
      </div>
    </div>
  );

  const renderSettings = () => (
    <div className="p-4 h-full">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <IOSCard className="space-y-0 !p-0 overflow-hidden mb-6">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-1.5 rounded-md text-white">
                    <Cpu size={18} />
                </div>
                <span className="text-gray-900 font-medium">Default Model</span>
            </div>
            <span className="text-gray-400 text-sm flex items-center">
                {formatModelName(selectedModel)} <ChevronRight size={16} />
            </span>
        </div>
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3">
                <div className="bg-gray-500 p-1.5 rounded-md text-white">
                    <Lock size={18} />
                </div>
                <span className="text-gray-900 font-medium">API Key</span>
            </div>
            <span className="text-gray-400 text-sm flex items-center">
                ••••••••{apiKey.slice(-4)} <ChevronRight size={16} />
            </span>
        </div>
        {/* Termux Shortcut in Settings */}
         <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => setCurrentView(AppView.TERMUX)}>
            <div className="flex items-center gap-3">
                <div className="bg-black p-1.5 rounded-md text-white">
                    <Terminal size={18} />
                </div>
                <span className="text-gray-900 font-medium">Termux Connection</span>
            </div>
            <span className={`text-sm flex items-center ${termuxConfig.isConnected ? 'text-green-500' : 'text-gray-400'}`}>
                {termuxConfig.isConnected ? 'Connected' : 'Not Connected'} <ChevronRight size={16} />
            </span>
        </div>
      </IOSCard>

      <div className="mt-8">
        <IOSButton variant="danger" fullWidth onClick={handleLogout}>
            Remove API Key & Logout
        </IOSButton>
      </div>
      
       <div className="mt-8 text-center">
         <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Version 4.2.0 (Cyber Core)</p>
       </div>
    </div>
  );

  // --- Main Layout ---

  if (hasCheckedKey && !isKeyValid) {
    return renderLogin();
  }

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-ios-bg text-gray-900 overflow-hidden font-sans relative">
      
      {showRateLimitModal && renderRateLimitModal()}

      {/* Sidebar (Desktop) / Bottom Nav (Mobile) */}
      <div className="
        md:w-64 md:h-full md:border-r md:border-gray-200 bg-white/80 backdrop-blur-xl
        fixed bottom-0 w-full h-20 border-t border-gray-200 z-40 md:relative md:z-auto
        flex md:flex-col justify-around md:justify-start md:pt-8 md:gap-2
      ">
        <div className="hidden md:flex items-center px-6 mb-8 gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-lg">G</span>
            </div>
            <span className="font-bold text-xl tracking-tight">Groq Client</span>
        </div>

        <NavButton 
            active={currentView === AppView.CHAT} 
            onClick={() => setCurrentView(AppView.CHAT)}
            icon={<MessageSquare size={24} />}
            label="Chat"
        />
        <NavButton 
            active={currentView === AppView.TERMUX} 
            onClick={() => setCurrentView(AppView.TERMUX)}
            icon={<Terminal size={24} />}
            label="Termux"
        />
        <NavButton 
            active={currentView === AppView.API_INFO} 
            onClick={() => setCurrentView(AppView.API_INFO)}
            icon={<Server size={24} />}
            label="API Status"
        />
        <NavButton 
            active={currentView === AppView.SETTINGS} 
            onClick={() => setCurrentView(AppView.SETTINGS)}
            icon={<Settings size={24} />}
            label="Settings"
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 h-full overflow-hidden relative pb-20 md:pb-0">
        {currentView === AppView.CHAT && renderChat()}
        {currentView === AppView.TERMUX && renderTermuxConfig()}
        {currentView === AppView.API_INFO && renderApiStatus()}
        {currentView === AppView.SETTINGS && renderSettings()}
      </div>

    </div>
  );
};

// Helper Component for Navigation
const NavButton = ({ active, onClick, icon, label }: { active: boolean, onClick: () => void, icon: React.ReactNode, label: string }) => (
    <button 
        onClick={onClick}
        className={`
            flex flex-col md:flex-row items-center md:px-6 md:py-3 gap-1 md:gap-3
            transition-colors duration-200
            ${active ? 'text-ios-blue' : 'text-gray-400 hover:text-gray-600'}
            md:${active ? 'bg-blue-50 border-r-4 border-ios-blue' : 'hover:bg-gray-50'}
        `}
    >
        {icon}
        <span className="text-[10px] md:text-sm font-medium">{label}</span>
    </button>
);

export default App;