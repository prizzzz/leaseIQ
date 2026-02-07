import React, { useState, useEffect, useRef } from 'react';
import './DealerSimulator.css';
import { api } from '../services/api'; 

const dealerSuggestions = {
  "thread-1": [
    { id: "a-q1", question: "What are the lease terms for this offer?", answer: "For this vehicle, the lease is 36 months, 10k miles per year, at $350 per month with standard fees." },
    { id: "a-q2", question: "Can I reduce the monthly payment with a higher down payment?", answer: "Yes. If you put $2,000 down, we can bring the monthly payment close to $330, depending on credit approval." },
    { id: "a-q3", question: "Are there any hidden fees I should know about?", answer: "Besides the monthly payment, there is a documentation fee, registration, and a disposition fee at the end of the lease." },
    { id: "a-q4", question: "Is maintenance included in this lease?", answer: "Regular maintenance is not included by default, but we can add a maintenance package for a small additional monthly fee." }
  ],
  "thread-2": [
    { id: "b-q1", question: "Can you match the price from another dealer?", answer: "If you share the exact quote, we will do our best to match or beat their monthly payment and terms." },
    { id: "b-q2", question: "What mileage options do you offer?", answer: "We typically offer 10k, 12k, and 15k miles per year. The monthly payment increases slightly as mileage goes up." },
    { id: "b-q3", question: "Can you explain the excess mileage charges?", answer: "Extra miles are usually charged between 15–25 cents per mile, depending on the specific model and lease program." },
    { id: "b-q4", question: "Do you offer any loyalty or college grad discounts?", answer: "Yes, we have loyalty and college graduate rebates that can lower your due-at-signing or monthly payment if you qualify." }
  ]
};

const initialThreads = [
  { id: "thread-1", title: "Dealer A - Lease Questions", messages: [{ id: "a-m0", sender: "dealer", text: "Hi, how can I help you with the following questions? Please pick one or type your question." }] },
  { id: "thread-2", title: "Dealer B - Offer Comparison", messages: [{ id: "b-m0", sender: "dealer", text: "Hi, I can help you compare our offer with other dealers. Select a question or type your own." }] }
];

const DealerSimulator = ({ activeContract }) => {
  const [threads, setThreads] = useState(initialThreads);
  const [activeThreadId, setActiveThreadId] = useState("thread-1");
  const [inputValue, setInputValue] = useState("");
  const [isTyping, setIsTyping] = useState(false); 
  const chatEndRef = useRef(null);

  const activeThread = threads.find(t => t.id === activeThreadId);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [activeThread.messages, isTyping]);

  const handleSendMessage = async (text) => {
    if (!text || !text.trim()) return;

    // 1. Add User Message to UI immediately
    const userMsg = { id: `u-${Date.now()}`, sender: "user", text: text.trim() };

    setThreads(prev => prev.map(t => 
      t.id === activeThreadId ? { ...t, messages: [...t.messages, userMsg] } : t
    ));
    setInputValue("");

    // 2. Check for Hardcoded Answer (Fast-Path Matching)
    const suggestions = dealerSuggestions[activeThreadId] || [];
    // const match = suggestions.find(s => 
    //   s.question.trim().toLowerCase() === text.trim().toLowerCase()
    // );

    // if (match) {
    //   setIsTyping(true);
    //   setTimeout(() => {
    //     const dealerMsg = { id: `d-${Date.now()}`, sender: "dealer", text: match.answer };
    //     setThreads(prev => prev.map(t => 
    //       t.id === activeThreadId ? { ...t, messages: [...t.messages, dealerMsg] } : t
    //     ));
    //     setIsTyping(false);
    //   }, 800);
    //   return;
    // }

    // 3. Check if Contract exists before calling AI (Deep-Path)
    if (!activeContract?.id) {
      setIsTyping(true);
      setTimeout(() => {
        const fallbackMsg = { 
          id: `d-${Date.now()}`, 
          sender: "dealer", 
          text: "Please upload a contract so I can give you a more specific answer." 
        };
        setThreads(prev => prev.map(t => 
          t.id === activeThreadId ? { ...t, messages: [...t.messages, fallbackMsg] } : t
        ));
        setIsTyping(false);
      }, 800);
      return;
    }

    // 4. Call Backend API using fetch (Deep-Path)
    setIsTyping(true);
    try {
      const response = await fetch(`http://localhost:5000/api/simulator/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify({
          message: text,
          file_id: activeContract.id,
          threadId: activeThreadId
        })
      });

      if (!response.ok) throw new Error("Server responded with an error");

      const data = await response.json();

      const aiMsg = { 
        id: `ai-${Date.now()}`, 
        sender: "dealer", 
        text: data.assistant_message 
      };

      setThreads(prev => prev.map(t => 
        t.id === activeThreadId ? { ...t, messages: [...t.messages, aiMsg] } : t
      ));
      console.log("Negotiating for Car:", activeContract.carName);
      console.log("Using Database ID:", activeContract.id);

    } catch (err) {
      console.error("Simulator Error:", err);
      // Fallback error message if backend route fails
      const errorMsg = { 
        id: `err-${Date.now()}`, 
        sender: "dealer", 
        text: "Sorry, I just stepped away from my desk. Let me check with my manager and get back to you." 
      };
      setThreads(prev => prev.map(t => 
        t.id === activeThreadId ? { ...t, messages: [...t.messages, errorMsg] } : t
      ));
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <div className="simulator-view-container">
      <aside className="sim-internal-sidebar">
        <div className="sim-sidebar-label">Dealer Threads</div>
        <div className="sim-thread-list">
          {threads.map(thread => (
            <div 
              key={thread.id} 
              className={`sim-thread-card ${thread.id === activeThreadId ? 'active' : ''}`}
              onClick={() => setActiveThreadId(thread.id)}
            >
              <span className="sim-thread-dot"></span>
              {thread.title}
            </div>
          ))}
        </div>
      </aside>

      <section className="sim-main-chat">
          <div className="sim-chat-header">
            <div className="sim-header-info">
              <h4>{activeThread.title}</h4>
              {activeContract ? (
                <div className="sim-active-badge">
                  <span className="dot pulse"></span>
                  Negotiating: <strong>{activeContract.carName}</strong>
                </div>
              ) : (
                <p className="sim-no-lease-text">⚠️ No lease selected from sidebar</p>
              )}
            </div>
          </div>
          
          {/* 1. SCROLLABLE AREA: Now only contains messages */}
          <div className="sim-messages-area custom-scrollbar">
            {activeThread.messages.map(msg => (
              <div key={msg.id} className={`sim-row ${msg.sender}`}>
                <div className="sim-bubble">{msg.text}</div>
              </div>
            ))}
        
            {isTyping && (
              <div className="sim-row dealer">
                <div className="sim-bubble typing">Dealer is typing...</div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>
        
          {/* 2. PINNED AREA: Moved outside scroll area to be near the input */}
          <div className="sim-suggestions-tray">
            <p>Select a tactic:</p>
            <div className="sim-suggestions-grid">
              {dealerSuggestions[activeThreadId].map(item => (
                <button 
                  key={item.id} 
                  onClick={() => handleSendMessage(item.question)}
                  disabled={isTyping}
                >
                  {item.question}
                </button>
              ))}
            </div>
          </div>
          
          {/* 3. INPUT AREA */}
          <div className="sim-input-wrapper">
            <div className="sim-input-container">
              <textarea
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(inputValue);
                  }
                }}
                // Disable if typing OR if no contract is selected
                placeholder={activeContract ? "Type your message..." : "Please select a lease to begin..."}
                disabled={isTyping || !activeContract} 
                rows="1"
              />
              <button 
                onClick={() => handleSendMessage(inputValue)} 
                disabled={isTyping || !inputValue.trim() || !activeContract} // Disable here too
                className="send-btn"
              >
                {isTyping ? "..." : "Send"}
              </button>
            </div>
          </div>
        </section>
    </div>
  );
};

export default DealerSimulator;






























// import React, { useState, useEffect, useRef } from 'react';
// import './DealerSimulator.css';
// import { api } from '../services/api'; 

// const dealerSuggestions = {
//   "thread-1": [
//     { id: "a-q1", question: "What are the lease terms for this offer?", answer: "For this vehicle, the lease is 36 months, 10k miles per year, at $350 per month with standard fees." },
//     { id: "a-q2", question: "Can I reduce the monthly payment with a higher down payment?", answer: "Yes. If you put $2,000 down, we can bring the monthly payment close to $330, depending on credit approval." },
//     { id: "a-q3", question: "Are there any hidden fees I should know about?", answer: "Besides the monthly payment, there is a documentation fee, registration, and a disposition fee at the end of the lease." },
//     { id: "a-q4", question: "Is maintenance included in this lease?", answer: "Regular maintenance is not included by default, but we can add a maintenance package for a small additional monthly fee." }
//   ],
//   "thread-2": [
//     { id: "b-q1", question: "Can you match the price from another dealer?", answer: "If you share the exact quote, we will do our best to match or beat their monthly payment and terms." },
//     { id: "b-q2", question: "What mileage options do you offer?", answer: "We typically offer 10k, 12k, and 15k miles per year. The monthly payment increases slightly as mileage goes up." },
//     { id: "b-q3", question: "Can you explain the excess mileage charges?", answer: "Extra miles are usually charged between 15–25 cents per mile, depending on the specific model and lease program." },
//     { id: "b-q4", question: "Do you offer any loyalty or college grad discounts?", answer: "Yes, we have loyalty and college graduate rebates that can lower your due-at-signing or monthly payment if you qualify." }
//   ]
// };

// const initialThreads = [
//   { id: "thread-1", title: "Dealer A - Lease Questions", messages: [{ id: "a-m0", sender: "dealer", text: "Hi, how can I help you with the following questions? Please pick one or type your question." }] },
//   { id: "thread-2", title: "Dealer B - Offer Comparison", messages: [{ id: "b-m0", sender: "dealer", text: "Hi, I can help you compare our offer with other dealers. Select a question or type your own." }] }
// ];

// const DealerSimulator = ({ activeContract }) => {
//   const [threads, setThreads] = useState(initialThreads);
//   const [activeThreadId, setActiveThreadId] = useState("thread-1");
//   const [inputValue, setInputValue] = useState("");
//   const [isTyping, setIsTyping] = useState(false); 
//   const chatEndRef = useRef(null);

//   const activeThread = threads.find(t => t.id === activeThreadId);

//   useEffect(() => {
//     chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
//   }, [activeThread.messages, isTyping]);

//   const handleSendMessage = async (text) => {
//     if (!text || !text.trim()) return;

//     // 1. Add User Message immediately
//     const userMsg = { id: `u-${Date.now()}`, sender: "user", text };
    
//     setThreads(prev => prev.map(t => 
//       t.id === activeThreadId ? { ...t, messages: [...t.messages, userMsg] } : t
//     ));
//     setInputValue("");

//     // 2. Check for Hardcoded Answer (Fast-Path)
//     const suggestions = dealerSuggestions[activeThreadId] || [];
//     const match = suggestions.find(s => s.question.toLowerCase() === text.toLowerCase());

//     if (match) {
//       setIsTyping(true);
//       setTimeout(() => {
//         const dealerMsg = { id: `d-${Date.now()}`, sender: "dealer", text: match.answer };
//         setThreads(prev => prev.map(t => 
//           t.id === activeThreadId ? { ...t, messages: [...t.messages, dealerMsg] } : t
//         ));
//         setIsTyping(false);
//       }, 800);
//       return;
//     }

//     // 3. Call Backend AI (Deep-Path) - Only if contract exists
//     if (!activeContract?.id) {
//         // Fallback if no contract is uploaded
//         setTimeout(() => {
//             const fallbackMsg = { id: `d-${Date.now()}`, sender: "dealer", text: "Please upload a contract so I can give you a more specific answer." };
//             setThreads(prev => prev.map(t => 
//                 t.id === activeThreadId ? { ...t, messages: [...t.messages, fallbackMsg] } : t
//             ));
//         }, 800);
//         return;
//     }
    
//     setIsTyping(true);
//     try {
//       const res = await api.post(`/api/simulator/chat`, {
//         message: text,
//         file_id: activeContract.id
//       });

//       const aiMsg = { 
//         id: `ai-${Date.now()}`, 
//         sender: "dealer", 
//         text: res.data.assistant_message 
//       };

//       setThreads(prev => prev.map(t => 
//         t.id === activeThreadId ? { ...t, messages: [...t.messages, aiMsg] } : t
//       ));
//     } catch (err) {
//       console.error("Simulator Error:", err);
//       const errorMsg = { 
//         id: `err-${Date.now()}`, 
//         sender: "dealer", 
//         text: "Sorry, I just stepped away from my desk. Let me check with my manager and get back to you." 
//       };
//       setThreads(prev => prev.map(t => 
//         t.id === activeThreadId ? { ...t, messages: [...t.messages, errorMsg] } : t
//       ));
//     } finally {
//       setIsTyping(false);
//     }
//   };

//   return (
//     <div className="simulator-view-container">
//       <aside className="sim-internal-sidebar">
//         <div className="sim-sidebar-label">Dealer Threads</div>
//         <div className="sim-thread-list">
//           {threads.map(thread => (
//             <div 
//               key={thread.id} 
//               className={`sim-thread-card ${thread.id === activeThreadId ? 'active' : ''}`}
//               onClick={() => setActiveThreadId(thread.id)}
//             >
//               <span className="sim-thread-dot"></span>
//               {thread.title}
//             </div>
//           ))}
//         </div>
//       </aside>

//       <section className="sim-main-chat">
//           <div className="sim-chat-header">
//             <div className="sim-header-info">
//               <h4>{activeThread.title}</h4>
//               <p>Active Negotiation Simulation</p>
//             </div>
//           </div>
          
//           {/* 1. SCROLLABLE AREA: Now only contains messages */}
//           <div className="sim-messages-area custom-scrollbar">
//             {activeThread.messages.map(msg => (
//               <div key={msg.id} className={`sim-row ${msg.sender}`}>
//                 <div className="sim-bubble">{msg.text}</div>
//               </div>
//             ))}
        
//             {isTyping && (
//               <div className="sim-row dealer">
//                 <div className="sim-bubble typing">Dealer is typing...</div>
//               </div>
//             )}
//             <div ref={chatEndRef} />
//           </div>
        
//           {/* 2. PINNED AREA: Moved outside scroll area to be near the input */}
//           <div className="sim-suggestions-tray">
//             <p>Select a tactic:</p>
//             <div className="sim-suggestions-grid">
//               {dealerSuggestions[activeThreadId].map(item => (
//                 <button 
//                   key={item.id} 
//                   onClick={() => handleSendMessage(item.question)}
//                   disabled={isTyping}
//                 >
//                   {item.question}
//                 </button>
//               ))}
//             </div>
//           </div>
          
//           {/* 3. INPUT AREA */}
//           <div className="sim-input-wrapper">
//             <div className="sim-input-container">
//               <textarea
//                 value={inputValue}
//                 onChange={(e) => setInputValue(e.target.value)}
//                 onKeyDown={(e) => {
//                   if (e.key === 'Enter' && !e.shiftKey) {
//                     e.preventDefault();
//                     handleSendMessage(inputValue);
//                   }
//                 }}
//                 placeholder="Type your message..."
//                 disabled={isTyping}
//                 rows="1"
//               />
//               <button 
//                 onClick={() => handleSendMessage(inputValue)} 
//                 disabled={isTyping || !inputValue.trim()}
//                 className="send-btn"
//               >
//                 {isTyping ? "..." : "Send"}
//               </button>
//             </div>
//           </div>
//         </section>
//     </div>
//   );
// };

// export default DealerSimulator;












