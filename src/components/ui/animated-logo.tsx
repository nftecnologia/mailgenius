'use client'

import React from 'react'

interface AnimatedLogoProps {
  size?: number
  className?: string
  animate?: boolean
}

export function AnimatedLogo({ size = 48, className = '', animate = true }: AnimatedLogoProps) {
  return (
    <div className={`relative ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox="0 0 80 80"
        className="drop-shadow-lg"
      >
        <defs>
          <linearGradient id="neural-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#7c3aed" />
            <stop offset="50%" stopColor="#a855f7" />
            <stop offset="100%" stopColor="#ec4899" />
          </linearGradient>

          {/* Glow filter for connections */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Animated connections */}
        <g className={animate ? "animate-pulse" : ""} filter="url(#glow)">
          <line
            x1="24" y1="27" x2="36" y2="17"
            stroke="url(#neural-gradient)"
            strokeWidth="2"
            opacity="0.6"
            className={animate ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}
            style={{ animationDelay: '0s' }}
          />
          <line
            x1="44" y1="17" x2="56" y2="27"
            stroke="url(#neural-gradient)"
            strokeWidth="2"
            opacity="0.6"
            className={animate ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}
            style={{ animationDelay: '0.3s' }}
          />
          <line
            x1="18" y1="42" x2="32" y2="38"
            stroke="url(#neural-gradient)"
            strokeWidth="2"
            opacity="0.6"
            className={animate ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}
            style={{ animationDelay: '0.6s' }}
          />
          <line
            x1="48" y1="38" x2="62" y2="42"
            stroke="url(#neural-gradient)"
            strokeWidth="2"
            opacity="0.6"
            className={animate ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}
            style={{ animationDelay: '0.9s' }}
          />
          <line
            x1="36" y1="46" x2="29" y2="61"
            stroke="url(#neural-gradient)"
            strokeWidth="2"
            opacity="0.6"
            className={animate ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}
            style={{ animationDelay: '1.2s' }}
          />
          <line
            x1="44" y1="46" x2="51" y2="61"
            stroke="url(#neural-gradient)"
            strokeWidth="2"
            opacity="0.6"
            className={animate ? "animate-[pulse_2s_ease-in-out_infinite]" : ""}
            style={{ animationDelay: '1.5s' }}
          />
        </g>

        {/* Neural network nodes with hover animations */}
        <g className="group">
          <circle
            cx="20" cy="25" r="4"
            fill="url(#neural-gradient)"
            className={animate ? "animate-[bounce_3s_ease-in-out_infinite] group-hover:scale-110 transition-transform" : ""}
            style={{ animationDelay: '0s' }}
          />
          <circle
            cx="40" cy="15" r="6"
            fill="url(#neural-gradient)"
            className={animate ? "animate-[bounce_3s_ease-in-out_infinite] group-hover:scale-110 transition-transform" : ""}
            style={{ animationDelay: '0.2s' }}
          />
          <circle
            cx="60" cy="25" r="4"
            fill="url(#neural-gradient)"
            className={animate ? "animate-[bounce_3s_ease-in-out_infinite] group-hover:scale-110 transition-transform" : ""}
            style={{ animationDelay: '0.4s' }}
          />
          <circle
            cx="15" cy="45" r="3"
            fill="url(#neural-gradient)"
            className={animate ? "animate-[bounce_3s_ease-in-out_infinite] group-hover:scale-110 transition-transform" : ""}
            style={{ animationDelay: '0.6s' }}
          />
          <circle
            cx="40" cy="40" r="8"
            fill="url(#neural-gradient)"
            className={animate ? "animate-[bounce_3s_ease-in-out_infinite] group-hover:scale-110 transition-transform" : ""}
            style={{ animationDelay: '0.8s' }}
          />
          <circle
            cx="65" cy="45" r="3"
            fill="url(#neural-gradient)"
            className={animate ? "animate-[bounce_3s_ease-in-out_infinite] group-hover:scale-110 transition-transform" : ""}
            style={{ animationDelay: '1s' }}
          />
          <circle
            cx="25" cy="65" r="4"
            fill="url(#neural-gradient)"
            className={animate ? "animate-[bounce_3s_ease-in-out_infinite] group-hover:scale-110 transition-transform" : ""}
            style={{ animationDelay: '1.2s' }}
          />
          <circle
            cx="55" cy="65" r="4"
            fill="url(#neural-gradient)"
            className={animate ? "animate-[bounce_3s_ease-in-out_infinite] group-hover:scale-110 transition-transform" : ""}
            style={{ animationDelay: '1.4s' }}
          />
        </g>

        {/* Floating particles effect */}
        {animate && (
          <g className="animate-[float_4s_ease-in-out_infinite]">
            <circle cx="10" cy="20" r="1" fill="url(#neural-gradient)" opacity="0.3" />
            <circle cx="70" cy="30" r="1" fill="url(#neural-gradient)" opacity="0.3" />
            <circle cx="15" cy="70" r="1" fill="url(#neural-gradient)" opacity="0.3" />
            <circle cx="65" cy="60" r="1" fill="url(#neural-gradient)" opacity="0.3" />
          </g>
        )}
      </svg>

      {/* Rotating glow effect */}
      {animate && (
        <div className="absolute inset-0 -z-10">
          <div className="w-full h-full bg-gradient-to-r from-purple-500/20 to-pink-500/20 rounded-full animate-spin" style={{ animationDuration: '8s' }}></div>
        </div>
      )}
    </div>
  )
}

export default AnimatedLogo
