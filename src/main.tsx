import { createRoot } from 'react-dom/client'
import '@fontsource-variable/manrope'
import '@fontsource/cormorant-garamond/300.css'
import '@fontsource/cormorant-garamond/400.css'
import './styles/index.css'
import App from './App'

const root = document.getElementById('root')
if (!root) throw new Error('The Nocturne root element is missing.')

createRoot(root).render(<App />)
