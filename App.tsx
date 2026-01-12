import React, { useState, useEffect, useRef } from 'react';
import { 
  MessageSquare, 
  Activity, 
  Settings, 
  Send, 
  Key, 
  Server, 
  CheckCircle, 
  AlertCircle, 
  Cpu, 
  Trash2,
  Lock,
  ChevronRight
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

import { AppView, Message, GROQ_MODELS, ApiStatusMetric } from './types';
import { chatWithGroq, checkGroqStatus } from './services/groqService';
import { IOSButton, IOSCard, IOSInput, IOSSegmentedControl } from './components/IOSComponents';

// --- Mock Data for Charts ---
const generateChartData = () => {
  return Array.from({ length: 20 }, (_, i) => ({
    time: `${i}s`,
    latency: Math.floor(Math.random() * 200) + 100, // 100-300ms
  }));
};

const App = () => {
  // State
  const [apiKey, setApiKey] = useState<string>('');
  const [tempKey, setTempKey] = useState<string>('');
  const [isKeyValid, setIsKeyValid] = useState<boolean>(false);
  const [hasCheckedKey, setHasCheckedKey] = useState<boolean>(false);
  const [currentView, setCurrentView] = useState<AppView>(AppView.CHAT);
  
  // Chat State
  const [messages, setMessages] = useState<Message[]>([
    { role: 'system', content: 'You are a helpful, smart assistant. Be concise and elegant.' }
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
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
  };

  const handleSaveKey = () => {
    if (tempKey.startsWith('gsk_')) {
      setApiKey(tempKey);
      verifyKey(tempKey);
    } else {
      alert('Invalid Groq API Key format. It should start with "gsk_".');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('groq_api_key');
    setApiKey('');
    setTempKey('');
    setIsKeyValid(false);
    setMessages([{ role: 'system', content: 'You are a helpful, smart assistant. Be concise and elegant.' }]);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !apiKey) return;

    const userMsg: Message = { role: 'user', content: inputMessage };
    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const response = await chatWithGroq([...messages, userMsg], apiKey, selectedModel);
      const assistantMsg = response.choices[0].message;
      setMessages(prev => [...prev, assistantMsg]);
    } catch (error: any) {
      setMessages(prev => [...prev, { role: 'system', content: `Error: ${error.message}` }]);
    } finally {
      setIsLoading(false);
    }
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
          <p className="text-gray-500 mt-2">Enter your Groq API key to start using the high-performance AI.</p>
        </div>
        
        <div className="space-y-4">
          <IOSInput 
            placeholder="gsk_..." 
            value={tempKey} 
            onChange={(e) => setTempKey(e.target.value)} 
            type="password"
            label="API Key"
          />
          <div className="text-xs text-gray-400 px-1">
            Your key is stored locally on your device and never sent to our servers.
          </div>
          <IOSButton onClick={handleSaveKey} fullWidth disabled={isLoading}>
            {isLoading ? 'Verifying...' : 'Access App'}
          </IOSButton>
        </div>
        
        <div className="mt-4 pt-4 border-t border-gray-100 text-center">
          <a href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer" className="text-ios-blue text-sm font-medium hover:underline">
            Get a Groq API Key &rarr;
          </a>
        </div>
      </IOSCard>
    </div>
  );

  const renderChat = () => (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex-none p-4 pb-2 bg-ios-bg/80 backdrop-blur-md sticky top-0 z-10 border-b border-gray-200">
        <div className="flex justify-between items-center mb-3">
            <h1 className="text-xl font-bold">Chat</h1>
            <IOSButton variant="ghost" className="!p-2" onClick={() => setMessages([messages[0]])}>
                <Trash2 className="w-5 h-5" />
            </IOSButton>
        </div>
        <IOSSegmentedControl 
          options={GROQ_MODELS.map(m => ({ label: m.split('-')[0], value: m }))}
          value={selectedModel}
          onChange={setSelectedModel}
        />
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 no-scrollbar">
        {messages.filter(m => m.role !== 'system').map((msg, idx) => (
          <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`
              max-w-[85%] p-3.5 rounded-2xl text-[15px] leading-relaxed shadow-sm
              ${msg.role === 'user' 
                ? 'bg-ios-blue text-white rounded-tr-sm' 
                : 'bg-white text-gray-800 rounded-tl-sm border border-gray-100'}
            `}>
              {msg.content}
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
            placeholder="Type a message..."
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

  const renderApiStatus = () => (
    <div className="p-4 space-y-6 overflow-y-auto h-full pb-24">
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

       <IOSCard className="mt-4">
        <h3 className="font-semibold text-gray-800 mb-2">Usage Directory</h3>
        <p className="text-sm text-gray-500 mb-4">
            To access the AI programmatically, use the following endpoint structure with your authenticated client.
        </p>
        <div className="bg-gray-900 rounded-lg p-3 overflow-x-auto">
            <code className="text-xs text-green-400 font-mono">
                POST /api/call<br/>
                Host: groq-ios-client.vercel.app<br/>
                Authorization: Bearer YOUR_KEY<br/>
                Content-Type: application/json<br/>
                <br/>
                {'{'}<br/>
                &nbsp;&nbsp;"model": "llama3-8b-8192",<br/>
                &nbsp;&nbsp;"messages": [...]<br/>
                {'}'}
            </code>
        </div>
       </IOSCard>
    </div>
  );

  const renderSettings = () => (
    <div className="p-4 h-full">
      <h1 className="text-2xl font-bold mb-6">Settings</h1>
      
      <IOSCard className="space-y-0 !p-0 overflow-hidden">
        <div className="p-4 flex items-center justify-between border-b border-gray-100">
            <div className="flex items-center gap-3">
                <div className="bg-blue-500 p-1.5 rounded-md text-white">
                    <Cpu size={18} />
                </div>
                <span className="text-gray-900 font-medium">Default Model</span>
            </div>
            <span className="text-gray-400 text-sm flex items-center">
                {selectedModel.split('-')[0]} <ChevronRight size={16} />
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
      </IOSCard>

      <div className="mt-8">
        <IOSButton variant="danger" fullWidth onClick={handleLogout}>
            Remove API Key & Logout
        </IOSButton>
        <p className="text-center text-gray-400 text-xs mt-3">
            Removing the key will require you to enter it again to access the chat features.
        </p>
      </div>

       <div className="mt-8 text-center">
         <p className="text-xs text-gray-400 uppercase tracking-widest font-semibold">Version 1.0.2</p>
         <p className="text-xs text-gray-300 mt-1">Deployed on Vercel</p>
       </div>
    </div>
  );

  // --- Main Layout ---

  if (hasCheckedKey && !isKeyValid) {
    return renderLogin();
  }

  return (
    <div className="h-screen w-full flex flex-col md:flex-row bg-ios-bg text-gray-900 overflow-hidden font-sans">
      
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