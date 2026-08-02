import { useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface IconHoverCircleProps {
  circleSize: number;
  circleColor?: string;
  children: ReactNode;
  style?: CSSProperties;
}

export default function IconHoverCircle({
  circleSize,
  circleColor = 'rgba(255,255,255,0.14)',
  children,
  style,
}: IconHoverCircleProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <span
      style={{
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        ...style,
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <span
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          width: circleSize,
          height: circleSize,
          borderRadius: '50%',
          background: hovered ? circleColor : 'transparent',
          pointerEvents: 'none',
        }}
      />
      <span style={{ position: 'relative', display: 'inline-flex' }}>{children}</span>
    </span>
  );
}
