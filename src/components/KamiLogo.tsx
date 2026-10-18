import React from 'react';
import { View } from 'react-native';
import Svg, { Path, Polygon, Rect, G } from 'react-native-svg';

interface KamiLogoProps {
  size?: number;
}

export const KamiLogo: React.FC<KamiLogoProps> = ({ size = 80 }) => {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" fill="none">
      {/* Top Face */}
      <Polygon
        points="50,15 82,32 50,49 18,32"
        fill="#FF9A44"
      />
      {/* Top Inner Diamond Highlight */}
      <Polygon
        points="50,23 66,32 50,41 34,32"
        fill="#FFE8D6"
      />

      {/* Left Face */}
      <Polygon
        points="18,35 47,51 47,85 18,69"
        fill="#FF8A5C"
      />
      {/* Left Inner Inset */}
      <Polygon
        points="25,43 40,51 40,75 25,67"
        fill="#FFE8D6"
      />

      {/* Right Face */}
      <Polygon
        points="53,51 82,35 82,69 53,85"
        fill="#FF7B00"
      />
      {/* Right Inner Inset */}
      <Polygon
        points="60,51 75,43 75,67 60,75"
        fill="#FFE8D6"
      />
    </Svg>
  );
};
