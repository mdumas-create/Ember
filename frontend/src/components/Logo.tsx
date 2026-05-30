import React from 'react';
import Svg, { Circle, Path, Defs, RadialGradient, Stop, G, Text as SvgText } from 'react-native-svg';
import { View, StyleSheet } from 'react-native';

interface LogoProps {
  size?: number;
  showText?: boolean;
}

const Logo: React.FC<LogoProps> = ({ size = 48, showText = true }) => {
  const symbolSize = size;
  const fontSize = size * 0.75;
  
  return (
    <View style={styles.container}>
      <Svg width={showText ? size * 3.5 : size} height={size} viewBox={`0 0 ${showText ? 168 : 48} 48`}>
        <Defs>
          <RadialGradient
            id="grad"
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

        {/* Símbolo: Círculo con gradiente */}
        <Circle cx="24" cy="24" r="24" fill="url(#grad)" />

        {/* Llama estilizada */}
        <Path
          d="M24 10C24 10 16 18 16 26C16 31 19.5 35 24 35C28.5 35 32 31 32 26C32 18 24 10 24 10ZM20 31C19 30 18.5 28.5 18.5 27C18.5 24 21 22 21 22C21 22 20.5 24 20.5 26C20.5 27.5 21.5 29 23 29.5C21.5 30 20.5 30.5 20 31Z"
          fill="#FDF4E3"
        />

        {showText && (
          <G x="58" y="34">
            {/* Texto "Ember" */}
            <SvgText
              fill="#F59E0B"
              fontSize="32"
              fontWeight="700"
              fontFamily="System"
            >
              Ember
            </SvgText>
            {/* Remate de llama en la E */}
            <Path
              d="M3 -28C3 -28 6 -32 8 -32C10 -32 11 -30 11 -28"
              stroke="#E07A5F"
              strokeWidth="2.5"
              fill="none"
              strokeLinecap="round"
            />
          </G>
        )}
      </Svg>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default Logo;
