import React, {useState} from 'react'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'
import EmailVerificationPage from './EmailVerificationPage'

const AuthPage = () => {
    const [login, setLogin] = useState('login')
  return (
    <>
    {login  ? <LoginPage setLogin={setLogin} /> :<RegisterPage setLogin={setLogin} /> }
    </>
  )
}

export default AuthPage