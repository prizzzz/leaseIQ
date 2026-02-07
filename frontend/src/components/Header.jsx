// import React, { useState, useRef, useEffect } from 'react';
// import { User, LogOut, ChevronDown, PanelRight } from 'lucide-react';
// import './Header.css';

// const Header = ({ 
//   user, 
//   onLogout, 
//   activeContract, 
//   onToggleSummary, 
//   isSummaryOpen, 
//   view 
// }) => {
//   const [isOpen, setIsOpen] = useState(false);
//   const dropdownRef = useRef(null);

//   // Logic to determine if we are in an active chat session
//   // const isChatActive = view === "chat" && activeContract && activeContract.chatHistory?.length > 0;
//   const isChatActive = activeContract && activeContract.chatHistory?.length > 0;
//   // Logic for the border: Hide border on welcome screen
//   const showBorder = isChatActive;

//   // Close dropdown if clicking outside
//   useEffect(() => {
//     const handleClickOutside = (event) => {
//       if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
//         setIsOpen(false);
//       }
//     };
//     document.addEventListener("mousedown", handleClickOutside);
//     return () => document.removeEventListener("mousedown", handleClickOutside);
//   }, []);

//   return (
//     <header className={`global-header ${showBorder ? "" : "no-border"}`}>
//       <div className="header-left">
//         {/* Chat Title: Slides in only when chat is active */}
//         <button className="mobile-menu-btn" onClick={props.onToggleSidebar}>
//           <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
//             <line x1="3" y1="12" x2="21" y2="12"></line>
//             <line x1="3" y1="6" x2="21" y2="6"></line>
//             <line x1="3" y1="18" x2="21" y2="18"></line>
//           </svg>
//         </button>
//         {isChatActive && (
//           <div className="header-titles animate-fade-in">
//             <h3>{activeContract.carName || "New Conversation"}</h3>
//             <span className="file-subtitle">
//               {activeContract.fileName || "General Inquiry"}
//             </span>
//           </div>
//         )}
//       </div>
      
//       <div className="header-right" ref={dropdownRef}>
//         {/* Summary Toggle: Placed beside the profile */}
//         {isChatActive && onToggleSummary && (
//           <button
//             className={`summary-toggle-btn ${isSummaryOpen ? "active" : ""}`}
//             onClick={onToggleSummary}
//             // REMOVE the disabled check for serverFilename so it works on all history items
//             disabled={!activeContract} 
//           >
//             <PanelRight size={20} />
//           </button>
//         )}

//         {/* Circular Profile Trigger */}
//         <div className="user-profile-dropdown">
//           <button className="profile-trigger" onClick={() => setIsOpen(!isOpen)}>
//             <div className="avatar user-profile">
//               {user?.name ? user.name[0].toUpperCase() : <User size={16} />}
//             </div>
//             <span className="user-firstname">{user?.name?.split(' ')[0] || "Amit"}</span>
//             <ChevronDown size={14} className={isOpen ? 'rotate' : ''} />
//           </button>

//           {isOpen && (
//             <div className="profile-dropdown">
//               <div className="dropdown-info">
//                 <p className="user-label">Logged in as</p>
//                 <strong>{user?.name || "Amit Verma"}</strong>
//                 <span>{user?.email || "amit@example.com"}</span>
//               </div>
//               <hr className="dropdown-divider" />
//               <button className="logout-item" onClick={onLogout}>
//                 <LogOut size={16} />
//                 <span>Sign out</span>
//               </button>
//             </div>
//           )}
//         </div>
//       </div>
//     </header>
//   );
// };

// export default Header;

import React, { useState, useRef, useEffect } from 'react';
import { User, LogOut, ChevronDown, PanelRight, Menu } from 'lucide-react'; // Added Menu icon
import './Header.css';

const Header = ({ 
  user, 
  onLogout, 
  activeContract, 
  onToggleSummary, 
  onToggleSidebar, // Add this here!
  isSummaryOpen, 
  view 
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Simplified logic so the button works across all views (Simulator, VIN, etc.)
  const isChatActive = activeContract && activeContract.chatHistory?.length > 0;
  const showBorder = isChatActive;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className={`global-header ${showBorder ? "has-chat-border" : "no-border"}`}>
      <div className="header-left">
        {/* Mobile Hamburger Button */}
        <button className="mobile-menu-btn" onClick={onToggleSidebar}>
          <Menu size={24} />
        </button>

        {view === 'chat' && isChatActive && (
          <div className="header-titles animate-fade-in">
            <h3>{activeContract.carName || "New Conversation"}</h3>
            <span className="file-subtitle">
              {activeContract.fileName || "General Inquiry"}
            </span>
          </div>
        )}
      </div>
      
      <div className="header-right" ref={dropdownRef}>
        {/* Summary Toggle: Works whenever a contract is selected */}
        {view === 'chat' && activeContract && onToggleSummary && (
          <button
            className={`summary-toggle-btn ${isSummaryOpen ? "active" : ""}`}
            onClick={onToggleSummary}
            title="Toggle Intelligence Panel"
          >
            <PanelRight size={20} />
          </button>
        )}

        <div className="user-profile-dropdown">
          <button className="profile-trigger" onClick={() => setIsOpen(!isOpen)}>
            <div className="avatar user-profile">
              {user?.name ? user.name[0].toUpperCase() : <User size={16} />}
            </div>
            <span className="user-firstname">{user?.name?.split(' ')[0] || "User"}</span>
            <ChevronDown size={14} className={isOpen ? 'rotate' : ''} />
          </button>

          {isOpen && (
            <div className="profile-dropdown">
              <div className="dropdown-info">
                <p className="user-label">Logged in as</p>
                <strong>{user?.name || "User Name"}</strong>
                <span>{user?.email || "user@example.com"}</span>
              </div>
              <hr className="dropdown-divider" />
              <button className="logout-item" onClick={onLogout}>
                <LogOut size={16} />
                <span>Sign out</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default Header;