import { Layout } from 'antd'
import { SchemaExplorer } from './components/SchemaExplorer'
import { Workspace } from './components/Workspace'
import { ResizableSider } from './components/ResizableSider'
import './App.css'

const { Content } = Layout

function App() {
  return (
    <Layout style={{ height: '100vh' }}>
      {/* Left Sidebar - Schema Explorer */}
      <ResizableSider
        defaultWidth={280}
        minWidth={200}
        maxWidth={600}
        theme="light"
        style={{
          overflow: 'auto',
          height: '100vh',
          borderRight: '1px solid #f0f0f0'
        }}
      >
        <SchemaExplorer />
      </ResizableSider>

      {/* Main Content - Workspace */}
      <Content
        style={{
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: '#fff'
        }}
      >
        <Workspace />
      </Content>
    </Layout>
  )
}

export default App
