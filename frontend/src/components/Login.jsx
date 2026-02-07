import React, { useState } from 'react';
// Added Eye and EyeOff icons
import { Mail, Lock, User, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
import './Login.css';

const Login = ({ onLoginSuccess }) => {
  const [isSignup, setIsSignup] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  // 1. New state for password visibility
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
    const payload = isSignup ? { name, email, password } : { email, password };

    try {
      const response = await fetch(`http://localhost:5000${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Something went wrong');

      localStorage.setItem('token', data.token);
      onLoginSuccess(data.token, data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-header">
          <ShieldCheck size={32} className="logo-icon text-indigo-500" />
          <h1>LeaseIQ</h1>
          <p>{isSignup ? "Create your account" : "Welcome back!"}</p>
        </div>

        {error && <div className="error-banner">{error}</div>}

        <form onSubmit={handleSubmit}>
          {isSignup && (
            <div className="input-group">
              <User size={18} />
              <input 
                type="text" 
                placeholder="Full Name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required 
              />
            </div>
          )}
          
          <div className="input-group">
            <Mail size={18} />
            <input 
              type="email" 
              placeholder="Email" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
            />
          </div>

          <div className="input-group">
            <Lock size={18} />
            <input 
              // 2. Dynamic type based on state
              type={showPassword ? "text" : "password"} 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            {/* 3. Toggle button inside the input group */}
            <button 
              type="button" 
              className="password-toggle"
              onClick={() => setShowPassword(!showPassword)}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? <Loader2 className="animate-spin" size={20} /> : (isSignup ? "Sign Up" : "Login")}
          </button>
        </form>

        <p className="toggle-auth">
          {isSignup ? "Already have an account?" : "Don't have an account?"}
          <span onClick={() => { setIsSignup(!isSignup); setError(''); }}>
            {isSignup ? " Login" : " Sign Up"}
          </span>
        </p>
      </div>
    </div>
  );
};

export default Login;

























































// import React, { useState } from 'react';
// import { Mail, Lock, User, Loader2, Eye, EyeOff, ShieldCheck } from 'lucide-react';
// import './Login.css';

// const Login = ({ onLoginSuccess }) => {
//   const [isSignup, setIsSignup] = useState(false);
//   const [email, setEmail] = useState('');
//   const [password, setPassword] = useState('');
//   const [name, setName] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState('');

//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     setLoading(true);
//     setError('');

//     // Determine which endpoint to hit
//     const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login';
//     const payload = isSignup ? { name, email, password } : { email, password };

//     try {
//       const response = await fetch(`http://localhost:5000${endpoint}`, {
//         method: 'POST',
//         headers: {
//           'Content-Type': 'application/json',
//         },
//         body: JSON.stringify(payload),
//       });

//       const data = await response.json();

//       if (!response.ok) {
//         // If server returns 400 or 500, throw the error message
//         throw new Error(data.message || 'Something went wrong');
//       }

//       // SUCCESS CASE
//       console.log('Success:', data.message);
      
//       // 1. Save token to local storage so user stays logged in
//       localStorage.setItem('token', data.token);

//       // 2. Trigger the App.jsx logic
//       onLoginSuccess(data.token, data.user);

//     } catch (err) {
//       setError(err.message);
//     } finally {
//       setLoading(false);
//     }
//   };

//   return (
//     <div className="login-page">
//       <div className="login-card">
//         <div className="login-header">
//           <ShieldCheck size={32} className="logo-icon text-indigo-500" />
//           <h1>LeaseIQ</h1>
//           <p>{isSignup ? "Create your account" : "Welcome back!"}</p>
//         </div>

//         {error && <div className="error-banner">{error}</div>}

//         <form onSubmit={handleSubmit}>
//           {isSignup && (
//             <div className="input-group">
//               <User size={18} />
//               <input 
//                 type="text" 
//                 placeholder="Full Name" 
//                 value={name}
//                 onChange={(e) => setName(e.target.value)}
//                 required 
//               />
//             </div>
//           )}
          
//           <div className="input-group">
//             <Mail size={18} />
//             <input 
//               type="email" 
//               placeholder="Email" 
//               value={email} 
//               onChange={(e) => setEmail(e.target.value)} 
//               required 
//             />
//           </div>

//           <div className="input-group">
//             <Lock size={18} />
//             <input 
//               type="password" 
//               placeholder="Password" 
//               value={password} 
//               onChange={(e) => setPassword(e.target.value)} 
//               required 
//             />
//           </div>

//           <button 
//             type="submit" 
//             className="login-btn" 
//             disabled={loading}
//           >
//             {loading ? (
//               <Loader2 className="animate-spin" size={20} />
//             ) : (
//               isSignup ? "Sign Up" : "Login"
//             )}
//           </button>
//         </form>

//         <p className="toggle-auth">
//           {isSignup ? "Already have an account?" : "Don't have an account?"}
//           <span onClick={() => {
//             setIsSignup(!isSignup);
//             setError('');
//           }}>
//             {isSignup ? " Login" : " Sign Up"}
//           </span>
//         </p>
//       </div>
//     </div>
//   );
// };

// export default Login;


































