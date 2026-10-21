import { NocturneRuntimeProvider } from './runtime/NocturneRuntime'
import { NocturneUI } from './ui/NocturneUI'

export default function App() {
  return (
    <NocturneRuntimeProvider>
      <NocturneUI />
    </NocturneRuntimeProvider>
  )
}
