import React from 'react'

const Spinner = () => {
  return (
    <div className="w-8 h-8 flex items-center justify-center">
      <svg
        className="animate-spin"
        width="18"
        height="18"
        viewBox="0 0 18 18"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <circle
          cx="9" cy="9" r="7"
          stroke="#3f3f46"  
          strokeWidth="2"
        />
        <path
          d="M9 2a7 7 0 0 1 7 7"
          stroke="#a3e635"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </svg>
    </div>
  )
}

export default Spinner