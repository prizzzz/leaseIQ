import React from "react";
import ReactMarkdown from "react-markdown";

export default function MessageBubble({ role, content }) {
  const isUser = role === "user";
  
  return (
    <div
      style={{
        display: "flex",
        justifyContent: isUser ? "flex-end" : "flex-start",
     
        marginBottom: "16px" // Increased spacing for a cleaner look
      }}
    >
      <div
        style={{
          maxWidth: "85%",
          padding: "12px 16px",
          borderRadius: isUser ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
          
          // Background: Teal for User, Slate for Assistant
          backgroundColor: isUser ? "rgba(33, 202, 185, 0.15)" : "rgba(30, 41, 59, 0.8)",
          
          // Font Colors: Teal for User, Off-white for Assistant
          color: isUser ? "#21CAB9" : "#E2E8F0", 
          
          fontSize: "0.875rem",
          lineHeight: "1.6",
          
          // Borders: Transparent teal for User, Slate border for Assistant
          border: isUser 
            ? "1px solid rgba(33, 202, 185, 0.3)" 
            : "1px solid rgba(75, 85, 99, 0.5)",
            
          boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.1)",
          wordBreak: "break-word",
        }}
      >
        {/* Markdown handles formatting for the email drafts and lists */}
        <ReactMarkdown
          components={{
            // Ensuring markdown paragraphs don't add extra unnecessary margins
            p: ({ node, ...props }) => <p style={{ margin: 0, marginBottom: "8px" }} {...props} />,
            // Styling links or code blocks if they appear in the AI text
            code: ({ node, ...props }) => (
              <code style={{ background: "rgba(0,0,0,0.2)", padding: "2px 4px", borderRadius: "4px" }} {...props} />
            )
          }}
        >
          {content}
        </ReactMarkdown>
      </div>
    </div>
  );
}







// import React from "react";
// import ReactMarkdown from "react-markdown";

// export default function MessageBubble({ role, content }) {
//   const isUser = role === "user";
  
//   return (
//     <div
//       style={{

//         display: "flex",
//         justifyContent: isUser ? "flex-end" : "flex-start",
//         marginBottom: "12px", // Increased spacing for better readability
//       }}
//     >
//       <div
//         style={{
//           maxWidth: "85%", // Slightly wider for detailed AI responses
//           padding: "10px 14px",
//           borderRadius: "14px",
//           // Dark mode colors to match your App.css
//           backgroundColor: isUser ? "#2563eb" : "rgba(30, 41, 59, 0.8)",
//           color: "#f3f4f6", 
//           fontSize: "0.85rem",
//           lineHeight: "1.4",
//           border: isUser ? "none" : "1px solid rgba(75, 85, 99, 0.5)",
//           boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
//         }}
//       >
//         {/* Using Markdown ensures email drafts and lists look professional */}
//         <ReactMarkdown>{content}</ReactMarkdown>
//       </div>
//     </div>
//   );
// }