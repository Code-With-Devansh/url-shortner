import React, {useState} from 'react'
import LoginPage from './LoginPage'
import RegisterPage from './RegisterPage'

const AuthPage = () => {
    const [login, setLogin] = useState(true)
  return (
    <>
    {login ? <LoginPage setLogin={setLogin} /> : <RegisterPage setLogin={setLogin} />}
    </>
  )
}

export default AuthPage