import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

describe('Example Test', () => {
  it('renders correctly', () => {
    const { getByText } = render(<Text>Hello Unsweet</Text>);
    expect(getByText('Hello Unsweet')).toBeTruthy();
  });
});
