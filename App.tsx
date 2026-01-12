import React, { useState, useEffect, useRef } from 'react';
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
  Copy
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

// --- Termux System Instruction ---
const TERMUX_SYSTEM_PROMPT = `
You are an advanced AI assistant capable of executing commands on the user's Termux Android terminal.
Current System: Linux/Android (Termux).

IMPORTANT: To suggest a command to be executed, you MUST wrap the command code in a special block exactly like this:
<<<CMD: your_command_here >>>

Example:
To list files, reply:
Here are your files:
<<<CMD: ls -la >>>

To install python:
I will install python for you.
<<<CMD: pkg install python >>>

Do NOT execute commands that destroy the system (like rm -rf /) without explicit user confirmation in the text.
Always prefer non-interactive commands (add -y to apt/pkg installs).
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
  const [termuxOutput, setTermuxOutput] = useState<string>('');
  const [isTermuxRunning, setIsTermuxRunning] = useState<boolean>(false);

  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: TERMUX_SYSTEM_PROMPT + ' You are a helpful, smart assistant. Be concise and elegant.' }
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
  }, [messages, termuxOutput]);

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

  // --- Termux Logic ---

  const saveTermuxConfig = async () => {
      // Basic validation
      let url = termuxConfig.url.trim();
      if (url.endsWith('/')) url = url.slice(0, -1); // remove trailing slash
      
      const newConfig = { ...termuxConfig, url };
      
      // Test Connection
      setIsTermuxRunning(true);
      try {
          const res = await fetch(`${url}/`, { 
              method: 'GET',
              headers: {
                  'Cache-Control': 'no-cache'
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
              throw new Error('Server returned invalid status');
          }
      } catch (e: any) {
          setTermuxConfig({ ...newConfig, isConnected: false });
          alert(`Failed to connect: ${e.message}\n\nPlease update your Python script to V6 (Support lhr.life).`);
      } finally {
          setIsTermuxRunning(false);
      }
  };

  const executeTermuxCommand = async (cmd: string) => {
      if (!termuxConfig.isConnected || !termuxConfig.url) {
          alert('Termux is not connected. Go to Settings/Termux to configure.');
          return;
      }

      setIsTermuxRunning(true);
      try {
          const res = await fetch(`${termuxConfig.url}/execute`, {
              method: 'POST',
              headers: {
                  'Content-Type': 'application/json',
                  'X-Auth-Token': termuxConfig.token
              },
              body: JSON.stringify({ command: cmd })
          });
          
          const data = await res.json();
          if (res.ok) {
             const output = data.stdout || data.stderr || "Command executed (no output).";
             // Append output to chat as a system message
             const outputMsg: Message = { 
                 role: 'system', 
                 content: `Termux Output:\n\`\`\`\n${output}\n\`\`\`` 
             };
             setMessages(prev => [...prev, outputMsg]);
          } else {
             alert(`Execution failed: ${data.error}`);
          }
      } catch (e: any) {
          alert(`Network Error: ${e.message}`);
      } finally {
          setIsTermuxRunning(false);
      }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !apiKey) return;

    // Pass context about Termux connection state
    const contextMsg = termuxConfig.isConnected 
        ? `[System Note: Termux is CONNECTED. You can execute commands.]`
        : `[System Note: Termux is NOT connected.]`;
    
    // Combine input
    const fullInput = inputMessage;

    const userMsg: Message = { role: 'user', content: fullInput };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      // Fix: Explicitly type msgsToSend as Message[] to ensure correct type for object literals
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

  // --- Message Renderer with Command Detection ---
  const renderMessageContent = (content: string) => {
      const cmdRegex = /<<<CMD:(.*?)>>>/g;
      const parts = content.split(cmdRegex);
      
      // If no command, return text
      if (parts.length === 1) return <div className="whitespace-pre-wrap">{content}</div>;

      return (
          <div className="whitespace-pre-wrap">
              {parts.map((part, i) => {
                  // Even indices are text, Odd indices are commands (because of split)
                  if (i % 2 === 0) return <span key={i}>{part}</span>;
                  
                  const cmd = part.trim();
                  return (
                      <div key={i} className="my-3 bg-gray-900 rounded-xl overflow-hidden border border-gray-700 shadow-lg">
                          <div className="bg-gray-800 px-3 py-2 flex items-center justify-between border-b border-gray-700">
                              <div className="flex items-center gap-2">
                                  <Terminal size={14} className="text-green-400" />
                                  <span className="text-xs text-gray-300 font-mono">Termux Command</span>
                              </div>
                          </div>
                          <div className="p-3 font-mono text-sm text-green-300 bg-black/50 overflow-x-auto">
                              {cmd}
                          </div>
                          <div className="p-2 bg-gray-800 flex justify-end">
                              <button 
                                  onClick={() => executeTermuxCommand(cmd)}
                                  disabled={isTermuxRunning || !termuxConfig.isConnected}
                                  className={`
                                    flex items-center gap-2 px-4 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wide
                                    transition-all active:scale-95
                                    ${termuxConfig.isConnected 
                                        ? 'bg-green-500 text-white hover:bg-green-600 shadow-green-900/20' 
                                        : 'bg-gray-600 text-gray-400 cursor-not-allowed'}
                                  `}
                              >
                                  {isTermuxRunning ? (
                                      <span className="animate-pulse">Running...</span>
                                  ) : (
                                      <>
                                          <Play size={12} fill="currentColor" />
                                          Run on Termux
                                      </>
                                  )}
                              </button>
                          </div>
                          {!termuxConfig.isConnected && (
                             <div className="px-3 pb-2 text-[10px] text-red-400 text-right">
                                 Termux not connected
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

  const renderChat = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none p-4 pb-2 bg-ios-bg/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold">Chat</h1>
            <div className="flex gap-2">
                 {termuxConfig.isConnected && (
                     <div className="bg-green-100 text-green-700 p-2 rounded-lg" title="Termux Connected">
                         <Terminal size={20} />
                     </div>
                 )}
                <IOSButton variant="ghost" className="!p-2" onClick={() => setMessages([messages[0]])}>
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
        {messages.filter(m => m.role !== 'system' || m.content.startsWith('Termux')).map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
              max-w-[90%] md:max-w-[75%] p-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm overflow-hidden
              ${msg.role === 'user' 
                ? 'bg-ios-blue text-white rounded-tr-sm' 
                : msg.content.startsWith('Termux Output')
                  ? 'bg-gray-800 text-gray-200 font-mono text-xs w-full'
                  : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'}
            `}>
              {msg.role === 'assistant' ? renderMessageContent(msg.content) : msg.content}
            </div>
          </div>
        ))}
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
            placeholder={termuxConfig.isConnected ? "Ask AI to run a Termux command..." : "Type a message..."}
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
              Connect Termux with SSH. Now supports Vercel (CORS Fixed V6).
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
                  <IOSButton onClick={saveTermuxConfig} disabled={isTermuxRunning}>
                      {isTermuxRunning ? 'Connecting...' : (termuxConfig.isConnected ? 'Update Connection' : 'Connect')}
                  </IOSButton>
              </div>
          </IOSCard>

          <IOSCard>
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                  <LinkIcon size={16} /> Connection Steps (V6)
              </h3>
              <ol className="text-sm text-gray-600 space-y-2 list-decimal list-inside">
                  <li>In Termux: <code className="bg-gray-100 px-1 rounded">pkg install python openssh</code></li>
                  <li>Install Flask: <code className="bg-gray-100 px-1 rounded">pip install flask</code></li>
                  <li>
                    <b>CRITICAL:</b> Update the script to V6 below.
                  </li>
                  <li>Run script. Copy URL ending in <b>.lhr.life</b> or <b>.localhost.run</b>.</li>
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
         <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Version 1.6.0 (LHR.life Support)</p>
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