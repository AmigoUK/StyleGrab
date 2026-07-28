import { render } from 'preact';
import '@/assets/ui.css';
import { LibraryApp } from './LibraryApp';

render(<LibraryApp />, document.getElementById('app')!);
