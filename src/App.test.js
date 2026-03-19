import { render, screen } from '@testing-library/react';
import App from './App';

test('renders soccer market page title', () => {
  render(<App />);
  expect(screen.getByText('足球早盘 / 比赛列表')).toBeInTheDocument();
});
