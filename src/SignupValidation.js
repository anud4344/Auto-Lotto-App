
function SignupValidation(values) {

    console.log("Inside of Validation for Signup:");
    console.log(`${values?.name}`);
    console.log(`${values?.password}`);

  let error = {}
  const email_pattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  const password_pattern = /^(?=.*\d)(?=.*[a-z])(?=.*[A-Z])[a-zA-Z0-9]{8,}$/
  
    // Trim all inputs to normalize user typing
  const name     = (values?.name     ?? '').trim();
  const email    = (values?.email    ?? '').trim();
  const password = (values?.password ?? '').trim();
  const address  = (values?.address  ?? '').trim();

  if (!name) {
      error.name = "Name should not be empty"
  }/*
  else {
      error.name = ""
  }*/
  
  if (!email) {
      error.email = "Email should not be empty"
  }/*
  else if(!email_pattern.test(email)) {
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

  if (!address) {
      error.address = "Address should not be empty"
  }/*
  else {
      error.address = ""
  }*/

  return error;

}

export default SignupValidation;