import { Image } from 'react-native';

export function MoodiWave({ color = '#D7CCFF', width = 29 }: { color?: string; width?: number }) {
  return <Image
    accessible={false}
    source={require('../../assets/images/moodi-wave.png')}
    style={{ width, height: width, tintColor: color }}
  />;
}
