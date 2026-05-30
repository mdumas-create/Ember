import React from 'react';
import Svg, { Circle, Path, Defs, RadialGradient, Stop } from 'react-native-svg';
import { View } from 'react-native';

interface IconProps {
  size?: number;
  color?: string;
  useGradient?: boolean;
}

const Icon: React.FC<IconProps> = ({ size = 24, color = '#E07A5F', useGradient = true }) => {
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox="0 0 48 48">
        {useGradient && (
          <Defs>
            <RadialGradient
              id="grad_icon"
              cx="24"
              cy="24"
              rx="24"
              ry="24"
              fx="24"
              fy="24"
              gradientUnits="userSpaceOnUse"
            >
              <Stop offset="0" stopColor="#F59E0B" />
              <Stop offset="1" stopColor="#E07A5F" />
            </RadialGradient>
          </Defs>
        )}

        {/* Símbolo: Círculo */}
        <Circle cx="24" cy="24" r="24" fill={useGradient ? "url(#grad_icon)" : color} />

        {/* Llama estilizada */}
        <Path
          d="M24 10C24 10 16 18 16 26C16 31 19.5 35 24 35C28.5 35 32 31 32 26C32 18 24 10 24 10ZM20 31C19 30 18.5 28.5 18.5 27C18.5 24 21 22 21 22C21 22 20.5 24 20.5 26C20.5 27.5 21.5 29 23 29.5C21.5 30 20.5 30.5 20 31Z"
          fill="#FDF4E3"
        />
      </Svg>
    </View>
  );
};

export default Icon;
