import React, {useState} from 'react';
import { Link, useNavigate } from 'react-router-dom';
import SignupValidation from './SignupValidation';
import { setToken } from './auth';

const API_BASE = 'http://localhost:4000';

function Signup() {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [address, setAddress] = useState('');


    const [errors, setErrors] = useState({});
    const [busy, setBusy] = useState(false);
    const navigate = useNavigate();

  const [values, setValues] = useState({
      name: '',
      email: '',
      password: '',
      address: ''
  })

  const handleInput = (event) => {
     setValues(prev => ({...prev, [event.target.name]: [event.target.value]}))
  }

  const handleChange = (event) => {
    const { name: key, value } = event.target;
    if (key === 'name') setName(value);
    if (key === 'email') setEmail(value);
    if (key === 'password') setPassword(value);
    if (key === 'address') setAddress(value);
  };

  /*const handleSubmit = (event) => {
     event.preventDefault();
     const err = Validation(values);
     setErrors(err);
  }*/
  const handleSubmit = async (event) => {
    event.preventDefault();
    
    setErrors({});

    const err = SignupValidation({ name, email, password, address });
    if (Object.keys(err).length) return setErrors(err);

    try {
      setBusy(true);

      // IF NO ERRORS ON SIGNUP --> POST TO BACKEND 
      const responseFromServer = await fetch(`${API_BASE}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type' : 'application/json' },
        body: JSON.stringify({ name, email, password, address })
      });
      const jsonFromServer = await responseFromServer.json();
      if (!responseFromServer.ok ) {
        setErrors({ form: jsonFromServer.error || 'Signup failed'});
      }
      //setToken(jsonFromServer.token);   // <-- this is where we save JWT 
      navigate('/login', {
        state: {
          justSignedUp: true, email
        }
      });     // <-- this will take us to Login.js   
    } catch (err) {
      setErrors({ form: 'Network or server error on signup'});
    } finally {
      setBusy(false);
    }
  }
  return (
      <div className='d-flex justify-content-center align-items-center bg-primary vh-100'>
      <div className='bg-white p-3 rounded w-25'>
         <h2>Auto Lotto: Ticket Claim & Verification</h2>
         <h2>Sign-Up</h2>
      <form action="" onSubmit={handleSubmit}>
         <div className='mb-3'>
             <label htmlFor="name"><strong>Name</strong></label>
             <input type="text" placeholder='Enter Name' name='name'
             value={name}
             onChange={handleChange} className='form-control rounded-0'/>
             {errors.name && <span className='text-danger'> {errors.name} </span>}
         </div>
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
         <div className='mb-3'>
             <label htmlFor="address"><strong>Address</strong></label>
             <input type="text" placeholder='Enter Address' name='address'
             value={address}
             onChange={handleChange} className='form-control rounded-0'/>
             {errors.address && <span className='text-danger'> {errors.address} </span>}
         </div>
         <button type='submit' className='btn btn-success w-100 rounded-0'>Sign up</button>
         <p>You need to agree to our terms and policies</p>
         <Link to='/' className='btn btn-default border w-100 bg-light rounded-0'>Login</Link>
     </form>
    </div>
        
    </div>
  )
}

export default Signup