
function LoginValidation(values) {
  let error = {}
  const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const password_pattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9]{8,}$/
  
   const email = (values?.email ?? '').trim();
   const password = (values?.password ?? '').trim();

   console.log(`Inside of LoginValidation | values?.email: ${values?.email}`);
   console.log(`Inside of LoginValidation | values?.password: ${values?.password}`);

  if (!email) {
      error.email = "Email should not be empty"
  }
  /*else if(!email_pattern.test(email)) {
     error.email = "Email did not match"
  } else {
     error.email = ""
  }*/
  if (!password) {
      error.password = "Password should not be empty"
  }
  /*
  else if(!password_pattern.test(password)) {
     error.password = "Password did not match"
  } else {
     error.password = ""
  }*/
  return error;
}

export default LoginValidation;