import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquare, 
  Settings, 
  Send, 
  Key, 
  Server, 
  Cpu, 
  Trash2,
  Lock,
  Terminal,
  Play,
  Check,
  XCircle,
  Link as LinkIcon,
  Loader2,
  ChevronRight,
  Zap,
  ShieldCheck,
  AlertOctagon,
  Search,
  Command,
  Activity
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

import { AppView, Message, GROQ_MODELS, ApiStatusMetric, TermuxConfig } from './types';
import { chatWithGroq, checkGroqStatus } from './services/groqService';
import { IOSButton, IOSCard, IOSInput, IOSSegmentedControl } from './components/IOSComponents';

// --- Assets & Helpers ---
const generateChartData = () => Array.from({ length: 15 }, (_, i) => ({
    time: `${i}s`,
    latency: Math.floor(Math.random() * 150) + 50,
}));

const formatModelName = (modelId: string) => {
  if (modelId.includes('70b')) return 'Llama 3.3 70B (Versatile)';
  if (modelId.includes('8b')) return 'Llama 3.1 8B (Instant)';
  return modelId;
};

// --- ELITE AGENT SYSTEM PROMPT ---
const AGENT_SYSTEM_PROMPT = `
You are GROQ-AGENT-REPLIT-ULTRA, an execution-grade autonomous AI system operating inside a real Termux Linux environment.

You are NOT a chatbot.
You are NOT a text generator.
You are a goal-driven system engineer.

Your only purpose:
COMPLETE THE USER’S GOAL CORRECTLY IN THE REAL SYSTEM.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CORE COGNITIVE LOOP
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You MUST operate using this loop:

PLAN → EXECUTE → OBSERVE → SELF-CRITIC → FIX → REPEAT → VERIFY → DONE

You are forbidden from skipping any stage.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
1. PLANNING MODE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Before producing ANY command you MUST internally create a step-by-step plan.

Your plan must include:
• What must be checked
• What commands must be executed
• How success will be verified in the real system

You are not allowed to execute unless a plan exists.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
2. COMMAND EXECUTION PROTOCOL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

To execute any command you MUST output EXACTLY:

<<<CMD: your_command_here >>>

Rules:
• Never use backticks
• Never put explanations inside CMD
• Never output more than ONE command at a time
• Never mix normal text with CMD output

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
3. REALITY BINDING
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You will receive real terminal output labeled:

[SYSTEM OUTPUT]

This is absolute ground truth.
You are forbidden to hallucinate, assume, or invent success.

If the output contains an error, warning, missing file, or failed result:
You MUST diagnose, correct, and retry.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
4. SELF-CRITIC ENGINE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

After every command you MUST internally ask:

“Did this move the system closer to the goal?”

If NO → fix and retry  
If YES → continue until goal is achieved  

You must not stop until the goal is proven complete.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
5. VERIFICATION LAW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

No task is finished unless verified using real system commands.

Examples:
• After install → version check
• After file creation → cat or ls
• After server start → curl or port check
• After delete → confirm absence

If verification fails → FIX → RETRY.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
6. DELETION SAFETY
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You may NEVER delete blindly.

Required flow:
1) Locate the target:
<<<CMD: find . -maxdepth 3 -iname "*target*" >>>
2) Ask the user to confirm
3) Only after confirmation, execute rm

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
7. FAILURE INTELLIGENCE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

If something breaks:
• Identify the real cause
• Explain it
• Apply the fix
• Retry

Never stop at the first failure.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
8. COMPLETION RULE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

You may only say:

“Completed successfully”

AFTER the system itself proves the goal has been achieved.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
YOU DO NOT FINISH — THE SYSTEM FINISHES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`;

const App = () => {
  // --- Global State ---
  const [apiKey, setApiKey] = useState<string>('');
  const [tempKey, setTempKey] = useState<string>('');
  const [isKeyValid, setIsKeyValid] = useState<boolean>(false);
  const [hasCheckedKey, setHasCheckedKey] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  
  // --- Termux State ---
  const [termuxConfig, setTermuxConfig] = useState<TermuxConfig>({ url: '', token: '12345', isConnected: false });
  const [activeCmdId, setActiveCmdId] = useState<string | null>(null);
  const [executionStatus, setExecutionStatus] = useState<string>('Idle');
  const [cmdResults, setCmdResults] = useState<Record<string, { success: boolean, output: string, timestamp: string }>>({});

  // --- Chat State ---
  const [messages, setMessages] = useState<Message[]>([{ role: 'system', content: AGENT_SYSTEM_PROMPT }]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(GROQ_MODELS[0]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Init ---
  useEffect(() => {
    const storedKey = localStorage.getItem('groq_api_key');
    if (storedKey) { setApiKey(storedKey); verifyKey(storedKey); } 
    else { setHasCheckedKey(true); }
    
    const storedTermux = localStorage.getItem('termux_config');
    if (storedTermux) setTermuxConfig(JSON.parse(storedTermux));
  }, []);

  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, activeCmdId, cmdResults]);

  // --- Logic: Auth & Connection ---
  const verifyKey = async (key: string) => {
    setIsLoading(true);
    const valid = await checkGroqStatus(key);
    setIsKeyValid(valid);
    setHasCheckedKey(true);
    setIsLoading(false);
    if (valid) localStorage.setItem('groq_api_key', key);
  };

  const handleSaveKey = () => {
    if (tempKey.startsWith('gsk_')) { setApiKey(tempKey); verifyKey(tempKey); }
    else alert('Invalid Format. Must start with gsk_');
  };

  const handleLogout = () => {
    localStorage.removeItem('groq_api_key');
    setApiKey(''); setIsKeyValid(false);
    setMessages([{ role: 'system', content: AGENT_SYSTEM_PROMPT }]);
  };

  const saveTermuxConfig = async () => {
      let url = termuxConfig.url.trim().replace(/\/$/, '');
      const newConfig = { ...termuxConfig, url };
      setExecutionStatus('Connecting...');
      
      try {
          const res = await fetch(`${url}/`, { 
              method: 'GET',
              headers: { 'ngrok-skip-browser-warning': 'true' }
          });
          if (res.ok) {
              const data = await res.json();
              if (data.status === 'online') {
                  const finalConfig = { ...newConfig, isConnected: true };
                  setTermuxConfig(finalConfig);
                  localStorage.setItem('termux_config', JSON.stringify(finalConfig));
                  setExecutionStatus('Connected');
                  setTimeout(() => setExecutionStatus('Idle'), 2000);
              }
          } else throw new Error("Server Error");
      } catch (e) {
          setTermuxConfig({ ...newConfig, isConnected: false });
          alert("Connection Failed. Check URL & Python Script.");
          setExecutionStatus('Error');
      }
  };

  // --- Logic: Smart Execution ---
  const executeCommand = async (cmd: string, cmdId: string) => {
      if (!termuxConfig.isConnected) return alert("Termux Disconnected");
      
      setActiveCmdId(cmdId);
      const phases = ['Resolving Path...', 'Allocating Resources...', 'Executing...'];
      
      for (const p of phases) {
          setExecutionStatus(p);
          await new Promise(r => setTimeout(r, 250));
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
          const output = data.stdout || data.stderr || "(No Output)";
          
          setCmdResults(prev => ({
              ...prev,
              [cmdId]: { success: res.ok, output, timestamp: new Date().toLocaleTimeString() }
          }));

          if (res.ok) handleAiAnalysis(cmd, output);

      } catch (e: any) {
          setCmdResults(prev => ({
              ...prev,
              [cmdId]: { success: false, output: `Connection Error: ${e.message}`, timestamp: new Date().toLocaleTimeString() }
          }));
      } finally {
          setActiveCmdId(null);
          setExecutionStatus('Idle');
      }
  };

  const handleAiAnalysis = async (cmd: string, output: string) => {
      setIsLoading(true);
      const systemMsg: Message = { 
          role: 'system', 
          content: `[SYSTEM OUTPUT for '${cmd}']: ${output}\n\nTask: Analyze this output against your plan. Verify if goal is met or if a fix is needed.` 
      };
      
      try {
          const res = await chatWithGroq([...messages, systemMsg], apiKey, selectedModel);
          setMessages(prev => [...prev, res.choices[0].message]);
      } catch (e) { console.error(e); } 
      finally { setIsLoading(false); }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !apiKey) return;

    const context = termuxConfig.isConnected 
        ? "[ENV: Termux Connected. CWD: ~/]" 
        : "[ENV: Termux Disconnected]";
    
    const userMsg: Message = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const history = [...messages, { role: 'system', content: context } as Message, userMsg];
      const res = await chatWithGroq(history, apiKey, selectedModel);
      setMessages(prev => [...prev, res.choices[0].message]);
    } catch (e: any) {
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  // --- RENDERERS ---

  const renderTerminalBlock = (cmd: string, cmdId: string) => {
      const result = cmdResults[cmdId];
      const isRunning = activeCmdId === cmdId;

      return (
          <div key={cmdId} className="my-4 rounded-xl overflow-hidden border border-gray-200/50 shadow-lg bg-[#1e1e1e] font-mono text-sm transform transition-all duration-300 hover:shadow-xl">
              {/* Window Header */}
              <div className="bg-[#2d2d2d] px-4 py-2 flex items-center justify-between border-b border-white/10">
                  <div className="flex gap-2">
                      <div className="w-3 h-3 rounded-full bg-[#ff5f56]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#ffbd2e]"></div>
                      <div className="w-3 h-3 rounded-full bg-[#27c93f]"></div>
                  </div>
                  <div className="text-[10px] text-gray-400 font-medium tracking-wide flex items-center gap-2">
                       <Terminal size={10} /> bash — 80x24
                  </div>
              </div>

              {/* Terminal Body */}
              <div className="p-4 text-gray-300 relative">
                  <div className="flex gap-3 items-center">
                      <span className="text-blue-400 font-bold">➜</span>
                      <span className="text-pink-400 font-bold">~</span>
                      <span className="text-gray-100 flex-1">{cmd}</span>
                  </div>

                  {/* Execution Overlay or Result */}
                  {isRunning ? (
                      <div className="mt-4 border-t border-white/10 pt-3">
                           <div className="flex items-center gap-3 text-yellow-400 text-xs animate-pulse">
                               <Loader2 size={14} className="animate-spin" />
                               {executionStatus}
                           </div>
                           <div className="h-1 w-full bg-gray-700 mt-2 rounded-full overflow-hidden">
                               <div className="h-full bg-yellow-400 animate-progress-indeterminate"></div>
                           </div>
                      </div>
                  ) : result ? (
                      <div className={`mt-3 pt-3 border-t border-white/10 text-xs whitespace-pre-wrap leading-relaxed ${result.success ? 'text-gray-400' : 'text-red-400'}`}>
                          {result.output}
                          <div className="mt-2 flex items-center gap-2">
                              <span className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${result.success ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                  {result.success ? 'Exit Code 0' : 'Failed'}
                              </span>
                              <span className="text-[10px] text-gray-600">{result.timestamp}</span>
                          </div>
                      </div>
                  ) : (
                      <div className="mt-4 flex justify-end">
                          <button 
                             onClick={() => executeCommand(cmd, cmdId)}
                             disabled={!termuxConfig.isConnected}
                             className={`
                                flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide transition-all
                                ${termuxConfig.isConnected 
                                    ? 'bg-blue-600 text-white hover:bg-blue-500 hover:shadow-blue-500/30 shadow-lg' 
                                    : 'bg-gray-700 text-gray-500 cursor-not-allowed'}
                             `}
                          >
                              <Play size={12} fill="currentColor" /> Execute
                          </button>
                      </div>
                  )}
              </div>
          </div>
      );
  };

  const renderMessage = (msg: Message, idx: number) => {
      if (msg.role === 'system' && msg.content.startsWith('[SYSTEM OUTPUT')) return null;

      const isUser = msg.role === 'user';
      const parts = msg.content.split(/<<<CMD:(.*?)>>>/g);

      return (
          <div key={idx} className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-6 group`}>
              {!isUser && (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-gray-900 to-gray-700 flex items-center justify-center text-white shadow-lg mr-3 mt-1 shrink-0">
                      <Zap size={14} fill="currentColor" />
                  </div>
              )}
              
              <div className={`max-w-[90%] md:max-w-[80%] ${isUser ? 'order-1' : 'order-2'}`}>
                  {/* Bubble */}
                  <div className={`
                      px-5 py-4 shadow-sm text-[15px] leading-relaxed relative
                      ${isUser 
                          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-[20px] rounded-tr-md shadow-blue-200' 
                          : 'bg-white/80 backdrop-blur-md border border-gray-100/50 text-gray-800 rounded-[20px] rounded-tl-md shadow-ios'}
                  `}>
                      {parts.map((part, i) => {
                          if (i % 2 === 0) {
                              if (!part.trim()) return null;
                              return (
                                  <div key={i} className={`markdown-body prose prose-sm max-w-none ${isUser ? 'text-white prose-headings:text-white prose-strong:text-white' : 'text-gray-800'}`}>
                                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
                                  </div>
                              );
                          }
                          return renderTerminalBlock(part.trim(), `cmd-${idx}-${i}`);
                      })}
                  </div>
                  
                  {/* Timestamp / Status */}
                  <div className={`text-[10px] text-gray-400 mt-1 px-1 opacity-0 group-hover:opacity-100 transition-opacity ${isUser ? 'text-right' : 'text-left'}`}>
                      {isUser ? 'Sent' : 'Agent • Llama 3'}
                  </div>
              </div>
          </div>
      );
  };

  // --- Views ---

  if (hasCheckedKey && !isKeyValid) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#F2F2F7] p-4">
            <div className="w-full max-w-md bg-white/70 backdrop-blur-xl rounded-[32px] p-8 shadow-2xl border border-white/50 animate-fade-in-up">
                <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-500/30">
                    <Key className="w-10 h-10 text-white" />
                </div>
                <h1 className="text-2xl font-bold text-center text-gray-900 mb-2">Groq Access</h1>
                <p className="text-center text-gray-500 mb-8 text-sm">Secure, high-performance API Gateway</p>
                <div className="space-y-4">
                    <IOSInput 
                        placeholder="gsk_..." 
                        value={tempKey} 
                        onChange={(e) => setTempKey(e.target.value)} 
                        type="password" 
                        className="!bg-white/50 !border-gray-200"
                    />
                    <IOSButton onClick={handleSaveKey} fullWidth disabled={isLoading} className="shadow-lg shadow-blue-500/20">
                        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Authenticate'}
                    </IOSButton>
                </div>
            </div>
        </div>
    );
  }

  return (
    <div className="h-screen w-full flex bg-[#F2F2F7] font-sans overflow-hidden">
      
      {/* Sidebar (Desktop) */}
      <nav className="hidden md:flex w-72 flex-col bg-white/60 backdrop-blur-xl border-r border-gray-200/50 z-20">
          <div className="p-6">
              <div className="flex items-center gap-3 px-2 mb-8">
                  <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg">
                      <Command className="text-white w-6 h-6" />
                  </div>
                  <div>
                      <h2 className="font-bold text-lg text-gray-900 leading-tight">Groq Agent</h2>
                      <span className="text-[10px] font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">PRO</span>
                  </div>
              </div>
              
              <div className="space-y-1">
                  {[
                      { id: AppView.CHAT, icon: MessageSquare, label: 'Agent Chat' },
                      { id: AppView.TERMUX, icon: Terminal, label: 'Termux Core' },
                      { id: AppView.API_INFO, icon: Server, label: 'System Status' },
                      { id: AppView.SETTINGS, icon: Settings, label: 'Preferences' }
                  ].map(item => (
                      <button 
                          key={item.id}
                          onClick={() => setCurrentView(item.id)}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-200 ${currentView === item.id ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500 hover:bg-white/50'}`}
                      >
                          <item.icon size={18} strokeWidth={2} />
                          {item.label}
                      </button>
                  ))}
              </div>
          </div>
          
          <div className="mt-auto p-6 border-t border-gray-200/50">
             <div className="bg-white/50 rounded-xl p-3 flex items-center justify-between border border-white/50">
                  <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${termuxConfig.isConnected ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                      <span className="text-xs font-medium text-gray-600">{termuxConfig.isConnected ? 'Online' : 'Offline'}</span>
                  </div>
                  <span className="text-[10px] text-gray-400 font-mono">v4.5</span>
             </div>
          </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative h-full w-full overflow-hidden">
          
          {/* Header (Mobile Only) */}
          <header className="md:hidden h-16 bg-white/70 backdrop-blur-lg border-b border-gray-200/50 flex items-center justify-between px-4 z-30 sticky top-0">
             <span className="font-bold text-lg">Groq Agent</span>
             <div className={`px-2 py-1 rounded-full text-[10px] font-bold border ${termuxConfig.isConnected ? 'bg-green-100 border-green-200 text-green-700' : 'bg-red-100 border-red-200 text-red-700'}`}>
                 {termuxConfig.isConnected ? 'ONLINE' : 'OFFLINE'}
             </div>
          </header>

          {/* Content Views */}
          <div className="flex-1 overflow-hidden relative">
              
              {/* CHAT VIEW */}
              {currentView === AppView.CHAT && (
                  <div className="flex flex-col h-full">
                      {/* Chat Messages */}
                      <div className="flex-1 overflow-y-auto p-4 md:p-8 space-y-2 no-scrollbar pb-32">
                          {messages.length === 1 && (
                              <div className="flex flex-col items-center justify-center h-[60vh] opacity-50 animate-fade-in-up">
                                  <div className="w-24 h-24 bg-gradient-to-tr from-gray-200 to-white rounded-[32px] flex items-center justify-center mb-6 shadow-ios border border-white">
                                      <Zap size={40} className="text-gray-400" fill="currentColor" />
                                  </div>
                                  <h3 className="text-2xl font-bold text-gray-800 mb-2">Agent Ready</h3>
                                  <p className="text-gray-500 max-w-xs text-center text-sm">
                                      Full-stack capabilities authorized. <br/> Connected to Termux environment.
                                  </p>
                              </div>
                          )}
                          {messages.map((m, i) => renderMessage(m, i))}
                          {isLoading && (
                              <div className="flex items-center gap-2 text-gray-400 text-xs ml-4 animate-pulse">
                                  <Loader2 size={12} className="animate-spin" /> Agent is analyzing...
                              </div>
                          )}
                          <div ref={messagesEndRef} />
                      </div>

                      {/* Chat Input */}
                      <div className="absolute bottom-0 w-full p-4 md:p-6 bg-gradient-to-t from-[#F2F2F7] via-[#F2F2F7]/90 to-transparent z-20 pb-24 md:pb-6">
                          <div className="max-w-3xl mx-auto bg-white/80 backdrop-blur-xl rounded-3xl shadow-lg border border-white/50 p-2 flex items-end gap-2">
                              <textarea
                                  value={inputMessage}
                                  onChange={(e) => setInputMessage(e.target.value)}
                                  onKeyDown={(e) => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), sendMessage())}
                                  placeholder={termuxConfig.isConnected ? "Instruct agent (e.g., 'Check git status')..." : "Ask a question..."}
                                  className="flex-1 bg-transparent border-none focus:ring-0 resize-none max-h-32 min-h-[48px] py-3 px-4 text-gray-800 placeholder-gray-400 text-[15px]"
                                  rows={1}
                              />
                              <button 
                                  onClick={sendMessage}
                                  disabled={!inputMessage.trim() || isLoading}
                                  className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-500/30 hover:bg-blue-700 transition-all disabled:opacity-50 disabled:shadow-none"
                              >
                                  <Send size={20} className={isLoading ? 'opacity-0' : 'opacity-100'} />
                                  {isLoading && <Loader2 size={20} className="absolute animate-spin" />}
                              </button>
                          </div>
                      </div>
                  </div>
              )}

              {/* TERMUX VIEW */}
              {currentView === AppView.TERMUX && (
                  <div className="p-6 md:p-10 max-w-3xl mx-auto overflow-y-auto h-full pb-32">
                      <h1 className="text-3xl font-bold text-gray-900 mb-2">Core Connection</h1>
                      <p className="text-gray-500 mb-8">Establish secure bridge to Termux environment via Python Flask.</p>

                      <div className="bg-white rounded-3xl p-6 shadow-ios border border-white/50 mb-6">
                          <div className="flex items-center gap-4 mb-6">
                              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${termuxConfig.isConnected ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-400'} transition-colors`}>
                                  <Terminal size={28} />
                              </div>
                              <div>
                                  <h3 className="font-bold text-gray-900">Bridge Status</h3>
                                  <p className={`text-sm ${termuxConfig.isConnected ? 'text-green-600' : 'text-gray-500'}`}>
                                      {termuxConfig.isConnected ? 'Active & Secure' : 'Disconnected'}
                                  </p>
                              </div>
                          </div>

                          <div className="space-y-4">
                              <IOSInput 
                                  label="Secure Tunnel URL"
                                  placeholder="https://xxxx.lhr.life"
                                  value={termuxConfig.url}
                                  onChange={(e) => setTermuxConfig({...termuxConfig, url: e.target.value})}
                              />
                              <IOSInput 
                                  label="Auth Token"
                                  type="password"
                                  value={termuxConfig.token}
                                  onChange={(e) => setTermuxConfig({...termuxConfig, token: e.target.value})}
                              />
                              <IOSButton onClick={saveTermuxConfig} fullWidth>
                                  {executionStatus === 'Idle' ? 'Establish Connection' : executionStatus}
                              </IOSButton>
                          </div>
                      </div>

                      <div className="bg-blue-50/50 rounded-3xl p-6 border border-blue-100">
                          <h4 className="font-bold text-blue-900 mb-2 flex items-center gap-2"><ShieldCheck size={18}/> Agent Protocol</h4>
                          <p className="text-sm text-blue-800/70 leading-relaxed">
                              This agent operates with elevated privileges. Ensure your Python script is running in a contained environment. The agent is trained to verify destructive commands, but proceed with caution.
                          </p>
                      </div>
                  </div>
              )}

              {/* SETTINGS VIEW */}
              {currentView === AppView.SETTINGS && (
                  <div className="p-6 md:p-10 max-w-2xl mx-auto">
                      <h1 className="text-3xl font-bold text-gray-900 mb-8">Preferences</h1>
                      
                      <div className="bg-white rounded-3xl overflow-hidden shadow-ios border border-white/50 mb-8">
                          <div className="p-4 border-b border-gray-100 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer">
                              <div className="flex items-center gap-4">
                                  <div className="bg-orange-500 p-2 rounded-lg text-white"><Cpu size={20}/></div>
                                  <span className="font-medium text-gray-900">AI Model</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400 text-sm">
                                  {formatModelName(selectedModel)} <ChevronRight size={16} />
                              </div>
                          </div>
                          <div className="p-4 flex items-center justify-between hover:bg-gray-50 transition-colors cursor-pointer">
                              <div className="flex items-center gap-4">
                                  <div className="bg-gray-500 p-2 rounded-lg text-white"><Lock size={20}/></div>
                                  <span className="font-medium text-gray-900">API Credentials</span>
                              </div>
                              <div className="flex items-center gap-2 text-gray-400 text-sm">
                                  Active <ChevronRight size={16} />
                              </div>
                          </div>
                      </div>

                      <IOSButton variant="danger" fullWidth onClick={handleLogout}>Disconnect Agent</IOSButton>
                  </div>
              )}

              {/* API INFO VIEW */}
              {currentView === AppView.API_INFO && (
                  <div className="p-6 md:p-10 max-w-4xl mx-auto h-full overflow-y-auto pb-32">
                      <h1 className="text-3xl font-bold text-gray-900 mb-8">System Metrics</h1>
                      
                      <div className="grid md:grid-cols-2 gap-6 mb-8">
                           <div className="bg-white p-6 rounded-3xl shadow-ios border border-white/50">
                               <div className="flex items-center gap-2 text-gray-500 mb-2 text-sm font-semibold uppercase tracking-wider">
                                   <Activity size={16}/> Latency
                               </div>
                               <div className="h-40 -ml-4">
                                   <ResponsiveContainer width="100%" height="100%">
                                       <AreaChart data={generateChartData()}>
                                           <defs>
                                               <linearGradient id="colorLat" x1="0" y1="0" x2="0" y2="1">
                                                   <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.3}/>
                                                   <stop offset="95%" stopColor="#3B82F6" stopOpacity={0}/>
                                               </linearGradient>
                                           </defs>
                                           <Area type="monotone" dataKey="latency" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#colorLat)" />
                                       </AreaChart>
                                   </ResponsiveContainer>
                               </div>
                           </div>
                           <div className="bg-white p-6 rounded-3xl shadow-ios border border-white/50 flex flex-col justify-center">
                               <div className="flex items-center gap-2 text-gray-500 mb-4 text-sm font-semibold uppercase tracking-wider">
                                   <Server size={16}/> Status
                               </div>
                               <div className="flex items-center gap-3">
                                   <div className="relative flex h-3 w-3">
                                     <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                                     <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500"></span>
                                   </div>
                                   <span className="text-2xl font-bold text-gray-900">Operational</span>
                               </div>
                               <p className="text-gray-400 text-sm mt-2">All Groq systems nominal.</p>
                           </div>
                      </div>
                  </div>
              )}

          </div>

          {/* Bottom Nav (Mobile Only) */}
          <div className="md:hidden h-20 bg-white/80 backdrop-blur-xl border-t border-gray-200/50 flex justify-around items-center px-2 pb-2 fixed bottom-0 w-full z-40">
              {[
                  { id: AppView.CHAT, icon: MessageSquare, label: 'Chat' },
                  { id: AppView.TERMUX, icon: Terminal, label: 'Termux' },
                  { id: AppView.SETTINGS, icon: Settings, label: 'Settings' }
              ].map(item => (
                  <button 
                      key={item.id}
                      onClick={() => setCurrentView(item.id)}
                      className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${currentView === item.id ? 'text-blue-600' : 'text-gray-400'}`}
                  >
                      <item.icon size={24} strokeWidth={currentView === item.id ? 2.5 : 2} />
                      <span className="text-[10px] font-medium">{item.label}</span>
                  </button>
              ))}
          </div>

      </main>
    </div>
  );
};

export default App;