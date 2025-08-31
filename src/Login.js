import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import LoginValidation from './LoginValidation';

// WE NEED AUTH FUNCTIONS: 
import { setToken } from './auth';

// WE NEED TO CONNECT THIS LOGIN PAGE TO BACKEND (postgres server)
const API_BASE = 'http://localhost:4000';

function Login() {

  const [values, setValues] = useState({
      email: '',
      password: ''
  });

  const location = useLocation();
  const [email, setEmail] = useState(location.state?.email || '');
  const [notice, setNotice] = useState(
    location.state?.justSignedUp ? 'Account created. Please sign in.' : ''
  );

  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);    // <-- use this to disable button while POSTing 

  const navigate = useNavigate(); 

  const handleInput = (event) => {
     setValues(prev => ({...prev, [event.target.name]: [event.target.value]}))
  }

  const handleChange = (event) => {
    const { name, value } = event.target; 

    if (name === 'email') setEmail(value);
    if (name === 'password') setPassword(value);
  }
  /*const handleSubmit = (event) => {
     event.preventDefault();
     const err = Validation(values);
     setErrors(err);
  }*/

  const handleSubmit = async (event) => {

    console.log(`inside Login.js POST | event: ${event}`);

    event.preventDefault();
    setErrors({}); 

    console.log('Trying validation...');
    const err = LoginValidation({ email, password });
    if (Object.keys(err).length) return setErrors(err); 
    //setErrors(err);

    console.log('Validation worked...');

    try {
      setBusy(true); 

      console.log(`inside Login.js POST | email: ${email}`);

      // IF NO ERRORS ON LOGIN --> POST TO BACKEND 
      const responseFromServer = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const jsonFromServer = await responseFromServer.json();
      if (!responseFromServer.ok || !jsonFromServer.token ) {
        setErrors({ form: jsonFromServer.error || 'Login failed'});
      }
      setToken(jsonFromServer.token);   // <-- this is where we save JWT 
      navigate('/');     // <-- this takes us to ImageClassifier.jsx 


    } catch (err) {
      setErrors({ form: 'Network or server error' });
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className='d-flex justify-content-center align-items-center bg-primary vh-100'>
      <div className='bg-white p-3 rounded w-25'>
        <h2>Auto Lotto: Ticket Claim & Verification</h2>
        <h2>Sign-in</h2>
       {notice && <div style = {{ color: '#2563eb', marginBottom: 8 }}>{notice}</div>}
      <form action="" onSubmit={handleSubmit}>
         <div className='mb-3'>
             <label htmlFor="email"><strong>Email</strong></label>
             <input type="email" placeholder='Enter Email' name='email'
             value={email}
             onChange={handleChange} className='form-control rounded-0'/>
             {errors.email && <span className='text-danger'> {errors.email} </span>}
         </div>
          <div className='mb-3'>
             <label htmlFor="password"><strong>Password</strong></label>
             <input type="password" placeholder='Enter Password' name='password'
             value={password}
             onChange={handleChange} className='form-control rounded-0'/>
             {errors.password && <span className='text-danger'> {errors.password} </span>}
         </div>
         <button type='submit' className='btn btn-success w-100 rounded-0'>Log in</button>
         
     </form>
     <p>You need to agree to our terms and policies</p>
         <Link to='/signup' className='btn btn-default border w-100 bg-light rounded-0'>Create Account</Link>
    </div>
        
    </div>
  );
}

export default Login