import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { 
  MessageSquare, Settings, Send, Terminal, Play, 
  Loader2, ChevronRight, Zap, ShieldCheck, 
  Activity, Server, Lock, Cpu, Command, Bot,
  Menu, X, Key
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area } from 'recharts';

import { AppView, Message, GROQ_MODELS, TermuxConfig } from './types';
import { chatWithGroq, checkGroqStatus } from './services/groqService';
import { IOSButton, IOSInput } from './components/IOSComponents';

// --- SYSTEM PROMPT (UNCHANGED LOGIC) ---
const AGENT_SYSTEM_PROMPT = `
You are SUPER-ENGINEER-AUTONOMOUS, an execution-grade autonomous AI system operating inside a real Termux Linux environment.
You are NOT a chatbot. You are a goal-driven system engineer.
Your only purpose: COMPLETE THE USER’S GOAL CORRECTLY IN THE REAL SYSTEM.

CORE COGNITIVE LOOP:
PLAN → EXECUTE → OBSERVE → SELF-CRITIC → FIX → REPEAT → VERIFY → DONE

1. PLANNING MODE: Create a plan before executing.
2. COMMAND EXECUTION: Output EXACTLY: <<<CMD: your_command_here >>>
3. REALITY BINDING: Trust [SYSTEM OUTPUT]. Do not hallucinate.
4. VERIFICATION LAW: Verify everything (e.g., git --version after install).
5. COMPLETION RULE: Only say "Completed successfully" after system proof.
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
  const [selectedModel] = useState(GROQ_MODELS[0]);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // --- Init ---
  useEffect(() => {
    const storedKey = localStorage.getItem('groq_api_key');
    if (storedKey) { setApiKey(storedKey); verifyKey(storedKey); } 
    else { setHasCheckedKey(true); }
    
    const storedTermux = localStorage.getItem('termux_config');
    if (storedTermux) setTermuxConfig(JSON.parse(storedTermux));
  }, []);

  useEffect(() => { 
    // Auto scroll to bottom when messages change
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); 
  }, [messages, activeCmdId, cmdResults]);

  // --- Logic ---
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
          alert("Connection Failed.");
          setExecutionStatus('Error');
      }
  };

  const executeCommand = async (cmd: string, cmdId: string) => {
      if (!termuxConfig.isConnected) return alert("Termux Disconnected");
      setActiveCmdId(cmdId);
      setExecutionStatus('Executing...');

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
          content: `[SYSTEM OUTPUT for '${cmd}']: ${output}\n\nTask: Analyze this output against your plan.` 
      };
      try {
          const res = await chatWithGroq([...messages, systemMsg], apiKey, selectedModel);
          setMessages(prev => [...prev, res.choices[0].message]);
      } catch (e) { console.error(e); } 
      finally { setIsLoading(false); }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !apiKey) return;
    const context = termuxConfig.isConnected ? "[ENV: Connected]" : "[ENV: Disconnected]";
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
          <div key={cmdId} className="my-2 rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
              <div className="bg-gray-50 px-3 py-2 flex items-center justify-between border-b border-gray-100">
                  <div className="flex items-center gap-2 text-xs font-mono text-gray-500">
                       <Terminal size={12} /> {cmd}
                  </div>
                  {!result && !isRunning && (
                    <button onClick={() => executeCommand(cmd, cmdId)} disabled={!termuxConfig.isConnected}
                        className="bg-blue-600 text-white px-3 py-1 rounded text-xs font-bold disabled:opacity-50">
                        RUN
                    </button>
                  )}
              </div>

              {(isRunning || result) && (
                  <div className="p-3 bg-[#1e1e1e] text-gray-300 font-mono text-xs overflow-x-auto">
                      {isRunning && <div className="flex gap-2 text-yellow-400"><Loader2 size={12} className="animate-spin"/> Executing...</div>}
                      {result && (
                          <>
                              <div className="whitespace-pre-wrap leading-relaxed">{result.output}</div>
                              <div className={`mt-2 text-[10px] uppercase font-bold ${result.success ? 'text-green-500' : 'text-red-500'}`}>
                                  {result.success ? 'Success' : 'Failed'} • {result.timestamp}
                              </div>
                          </>
                      )}
                  </div>
              )}
          </div>
      );
  };

  const renderMessage = (msg: Message, idx: number) => {
      if (msg.role === 'system') return null;
      const isUser = msg.role === 'user';
      const parts = msg.content.split(/<<<CMD:(.*?)>>>/g);

      return (
          <div key={idx} className={`flex flex-col mb-6 ${isUser ? 'items-end' : 'items-start'} w-full`}>
              {!isUser && (
                  <div className="flex items-center gap-2 mb-1 px-1">
                       <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded">Engineer</span>
                  </div>
              )}
              
              <div className={`w-full max-w-full ${isUser ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm md:max-w-[80%]' : 'px-1'}`}>
                  {parts.map((part, i) => {
                      if (i % 2 === 0) {
                          if (!part.trim()) return null;
                          return (
                              <div key={i} className={`markdown-body break-words ${isUser ? 'text-white' : 'text-gray-800'}`}>
                                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{part}</ReactMarkdown>
                              </div>
                          );
                      }
                      return renderTerminalBlock(part.trim(), `cmd-${idx}-${i}`);
                  })}
              </div>
          </div>
      );
  };

  // --- AUTH SCREEN ---
  if (hasCheckedKey && !isKeyValid) {
    return (
        <div className="h-[100dvh] w-full flex flex-col items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-sm bg-white rounded-2xl p-8 shadow-xl border border-gray-100">
                <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-200">
                    <Key className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-xl font-bold text-center text-gray-900 mb-2">Access Required</h1>
                <p className="text-center text-gray-500 mb-6 text-sm">Enter your Groq API Key to proceed.</p>
                <div className="space-y-3">
                    <IOSInput placeholder="gsk_..." value={tempKey} onChange={(e) => setTempKey(e.target.value)} type="password"/>
                    <IOSButton onClick={handleSaveKey} fullWidth disabled={isLoading}>
                        {isLoading ? <Loader2 className="animate-spin mx-auto" /> : 'Enter System'}
                    </IOSButton>
                </div>
            </div>
        </div>
    );
  }

  // --- MAIN APP LAYOUT (FLEXBOX - NO OVERLAP) ---
  return (
    <div className="h-[100dvh] w-full flex flex-col bg-white overflow-hidden">
      
      {/* 1. Header (Fixed Height) */}
      <header className="flex-none h-14 bg-white border-b border-gray-100 flex items-center justify-between px-4 z-10">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
                <Terminal size={16} className="text-white" />
            </div>
            <span className="font-bold text-gray-900 tracking-tight">Groq<span className="text-blue-600">Engineer</span></span>
         </div>
         <div className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide border ${termuxConfig.isConnected ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
             {termuxConfig.isConnected ? 'Connected' : 'Offline'}
         </div>
      </header>

      {/* 2. Main Content Area (Expands to fill space) */}
      <main className="flex-1 overflow-hidden relative flex flex-col min-h-0">
          
          {currentView === AppView.CHAT && (
              <div className="flex flex-col h-full w-full">
                  {/* Messages List (Scrolls independently) */}
                  <div className="flex-1 overflow-y-auto p-4 scroll-smooth">
                      {messages.length === 1 && (
                          <div className="h-full flex flex-col items-center justify-center text-gray-300 opacity-60">
                              <Bot size={48} className="mb-4 text-gray-200" />
                              <p className="text-sm font-medium">System Ready</p>
                          </div>
                      )}
                      {messages.map((m, i) => renderMessage(m, i))}
                      {isLoading && (
                          <div className="flex items-center gap-2 text-gray-400 text-xs animate-pulse pl-1">
                              <Loader2 size={12} className="animate-spin" /> Engineer is thinking...
                          </div>
                      )}
                      <div ref={messagesEndRef} className="h-2" />
                  </div>

                  {/* Input Area (Sticks to bottom of Chat view, pushes messages up) */}
                  <div className="flex-none border-t border-gray-100 bg-gray-50/50 p-3">
                      <div className="max-w-4xl mx-auto flex gap-2 items-end">
                          <textarea
                              value={inputMessage}
                              onChange={(e) => setInputMessage(e.target.value)}
                              placeholder="Type command or instruction..."
                              className="flex-1 bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-none max-h-32 min-h-[48px]"
                              rows={1}
                              style={{ height: '48px' }}
                          />
                          <button 
                              onClick={sendMessage}
                              disabled={!inputMessage.trim() || isLoading}
                              className="w-12 h-12 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-blue-600 transition-colors shadow-sm flex-shrink-0"
                          >
                              {isLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                          </button>
                      </div>
                  </div>
              </div>
          )}

          {currentView === AppView.TERMUX && (
              <div className="h-full overflow-y-auto p-6 max-w-md mx-auto w-full">
                  <h2 className="text-lg font-bold mb-4">Termux Bridge</h2>
                  <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm space-y-4">
                      <IOSInput label="Bridge URL" value={termuxConfig.url} onChange={(e) => setTermuxConfig({...termuxConfig, url: e.target.value})} placeholder="https://..." />
                      <IOSInput label="Token" type="password" value={termuxConfig.token} onChange={(e) => setTermuxConfig({...termuxConfig, token: e.target.value})} />
                      <IOSButton onClick={saveTermuxConfig} disabled={executionStatus !== 'Idle'}>
                          {executionStatus === 'Idle' ? 'Connect' : executionStatus}
                      </IOSButton>
                  </div>
                  <div className="mt-6 text-xs text-gray-500 bg-gray-50 p-4 rounded-lg">
                      Ensure your Python server is running in Termux. This allows the agent to execute shell commands remotely.
                  </div>
              </div>
          )}

          {currentView === AppView.SETTINGS && (
              <div className="h-full overflow-y-auto p-6 max-w-md mx-auto w-full">
                  <h2 className="text-lg font-bold mb-4">Settings</h2>
                  <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                          <span className="text-sm font-medium">Model</span>
                          <span className="text-xs text-gray-500">{selectedModel}</span>
                      </div>
                      <div className="p-4 border-b border-gray-100 flex justify-between items-center">
                          <span className="text-sm font-medium">API Status</span>
                          <span className="text-xs text-green-600 font-bold">Active</span>
                      </div>
                  </div>
                  <IOSButton variant="danger" className="mt-6" fullWidth onClick={handleLogout}>Log Out</IOSButton>
              </div>
          )}
      </main>

      {/* 3. Bottom Navigation (Fixed Height) */}
      <nav className="flex-none h-16 bg-white border-t border-gray-100 flex justify-around items-center px-2 pb-safe">
          {[
              { id: AppView.CHAT, icon: MessageSquare, label: 'Chat' },
              { id: AppView.TERMUX, icon: Terminal, label: 'Termux' },
              { id: AppView.SETTINGS, icon: Settings, label: 'Config' }
          ].map(item => (
              <button 
                  key={item.id}
                  onClick={() => setCurrentView(item.id)}
                  className={`flex flex-col items-center gap-1 p-2 w-16 rounded-lg transition-all ${currentView === item.id ? 'text-blue-600' : 'text-gray-400 hover:text-gray-600'}`}
              >
                  <item.icon size={20} strokeWidth={currentView === item.id ? 2.5 : 2} />
                  <span className="text-[10px] font-medium">{item.label}</span>
              </button>
          ))}
      </nav>
      
    </div>
  );
};

export default App;