import React from 'react';
import type { Language } from '../../context/LanguageContext';

interface FlagIconProps {
  code: Language | string;
  size?: number;
  className?: string;
}

export const FlagIcon: React.FC<FlagIconProps> = ({ code, size = 18, className = '' }) => {
  const width = size * 1.33; // Proporción 4:3
  const height = size;

  const renderFlag = () => {
    switch (code) {
      case 'es': // España: Rojo, Amarillo (doble), Rojo
        return (
          <svg viewBox="0 0 750 500" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="750" height="500" fill="#c60b1e" />
            <rect y="125" width="750" height="250" fill="#ffc400" />
          </svg>
        );
      case 'en': // Reino Unido (Union Jack simplificada)
        return (
          <svg viewBox="0 0 600 300" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="600" height="300" fill="#012169" />
            <path d="M0,0 L600,300 M600,0 L0,300" stroke="#fff" strokeWidth="60" />
            <path d="M0,0 L600,300 M600,0 L0,300" stroke="#C8102E" strokeWidth="40" />
            <path d="M300,0 V300 M0,150 H600" stroke="#fff" strokeWidth="100" />
            <path d="M300,0 V300 M0,150 H600" stroke="#C8102E" strokeWidth="60" />
          </svg>
        );
      case 'zh': // China: Rojo con estrella dorada principal y secundarias
        return (
          <svg viewBox="0 0 900 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="900" height="600" fill="#ee1c25" />
            <polygon points="150,60 177,143 245,143 190,183 211,266 150,222 89,266 110,183 55,143 123,143" fill="#ffde00" />
            <circle cx="300" cy="90" r="15" fill="#ffde00" />
            <circle cx="360" cy="150" r="15" fill="#ffde00" />
            <circle cx="360" cy="240" r="15" fill="#ffde00" />
            <circle cx="300" cy="300" r="15" fill="#ffde00" />
          </svg>
        );
      case 'hi': // India: Naranja, Blanco (con Ashoka Chakra azul), Verde
        return (
          <svg viewBox="0 0 900 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="900" height="200" fill="#FF9933" />
            <rect y="200" width="900" height="200" fill="#FFFFFF" />
            <rect y="400" width="900" height="200" fill="#128807" />
            <circle cx="450" cy="300" r="70" fill="none" stroke="#000080" strokeWidth="10" />
            <circle cx="450" cy="300" r="15" fill="#000080" />
          </svg>
        );
      case 'fr': // Francia: Azul, Blanco, Rojo
        return (
          <svg viewBox="0 0 900 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="300" height="600" fill="#002395" />
            <rect x="300" width="300" height="600" fill="#FFFFFF" />
            <rect x="600" width="300" height="600" fill="#ED2939" />
          </svg>
        );
      case 'ar': // Arabia Saudí / Árabe (Verde con espada blanca)
        return (
          <svg viewBox="0 0 900 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="900" height="600" fill="#006C35" />
            <rect x="250" y="380" width="400" height="30" rx="5" fill="#FFFFFF" />
            <polygon points="250,395 200,370 200,420" fill="#FFFFFF" />
          </svg>
        );
      case 'bn': // Bangladesh: Verde con disco rojo
        return (
          <svg viewBox="0 0 1000 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="1000" height="600" fill="#006a4e" />
            <circle cx="450" cy="300" r="200" fill="#f42a41" />
          </svg>
        );
      case 'pt': // Portugués (Verde y Rojo)
        return (
          <svg viewBox="0 0 600 400" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="240" height="400" fill="#046A38" />
            <rect x="240" width="360" height="400" fill="#DA291C" />
            <circle cx="240" cy="200" r="70" fill="#FFC72C" />
          </svg>
        );
      case 'id': // Indonesia: Rojo y Blanco
        return (
          <svg viewBox="0 0 900 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="900" height="300" fill="#FF0000" />
            <rect y="300" width="900" height="300" fill="#FFFFFF" />
          </svg>
        );
      case 'ur': // Pakistán / Urdu: Franja blanca y verde con creciente y estrella
        return (
          <svg viewBox="0 0 900 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="225" height="600" fill="#FFFFFF" />
            <rect x="225" width="675" height="600" fill="#115740" />
            <circle cx="560" cy="300" r="140" fill="#FFFFFF" />
            <circle cx="600" cy="270" r="120" fill="#115740" />
            <polygon points="630,220 642,248 672,248 647,266 657,294 630,276 603,294 613,266 588,248 618,248" fill="#FFFFFF" />
          </svg>
        );
      case 'ru': // Rusia: Blanco, Azul, Rojo
        return (
          <svg viewBox="0 0 900 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="900" height="200" fill="#FFFFFF" />
            <rect y="200" width="900" height="200" fill="#0039A6" />
            <rect y="400" width="900" height="200" fill="#D52B1E" />
          </svg>
        );
      case 'de': // Alemania: Negro, Rojo, Dorado
        return (
          <svg viewBox="0 0 900 540" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="900" height="180" fill="#000000" />
            <rect y="180" width="900" height="180" fill="#DD0000" />
            <rect y="360" width="900" height="180" fill="#FFCC00" />
          </svg>
        );
      case 'ja': // Japón: Blanco con disco solar rojo
        return (
          <svg viewBox="0 0 900 600" width={width} height={height} className={className} style={{ borderRadius: '2px', display: 'inline-block', verticalAlign: 'middle' }} aria-hidden="true">
            <rect width="900" height="600" fill="#FFFFFF" stroke="#e0e0e0" strokeWidth="1" />
            <circle cx="450" cy="300" r="180" fill="#BC002D" />
          </svg>
        );
      default:
        return (
          <span style={{ fontSize: `${size}px`, lineHeight: 1 }}>🌐</span>
        );
    }
  };

  return renderFlag();
};

export default FlagIcon;
