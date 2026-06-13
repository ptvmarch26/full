import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { spawn, spawnSync } from 'child_process'
import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function killRunnerPid(pidFile) {
  try {
    if (!fs.existsSync(pidFile)) return
    const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim())
    if (!pid || isNaN(pid)) return
    if (process.platform === 'win32') {
      spawnSync('taskkill', ['/F', '/T', '/PID', String(pid)], { shell: false, windowsHide: true })
    } else {
      try { process.kill(pid, 'SIGTERM') } catch {}
    }
    fs.unlinkSync(pidFile)
  } catch {}
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'run-demo-middleware',
      configureServer(server) {
        server.middlewares.use('/api/run-demo', (req, res) => {
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.end('Method Not Allowed')
            return
          }
          let body = ''
          req.on('data', chunk => { body += chunk })
          req.on('end', () => {
            let config = {}
            try { config = JSON.parse(body) } catch {}

            // Write config to file — avoids shell escaping issues with base64 on Windows
            const outDir = path.join(__dirname, 'public', 'runs', 'latest')
            fs.mkdirSync(outDir, { recursive: true })
            const cfgFile = path.join(outDir, 'run-config.json')
            fs.writeFileSync(cfgFile, JSON.stringify(config, null, 2))

            // Kill any existing runner before starting a new one
            const pidFile = path.join(outDir, '.runner.pid')
            killRunnerPid(pidFile)

            const runnerPath = path.join(__dirname, 'scripts', 'run-demo.cjs')
            const child = spawn('node', [runnerPath, '--config', cfgFile], {
              cwd: __dirname,
              detached: true,
              stdio: 'ignore',
              windowsHide: true,
            })
            // Track runner PID so subsequent calls can kill it
            try { fs.writeFileSync(pidFile, String(child.pid)) } catch {}
            child.unref()
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true, pid: child.pid }))
          })
        })

        server.middlewares.use('/api/stop-demo', (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
          import('fs').then(({ default: fs }) => {
            fs.writeFileSync(path.join(__dirname, 'public', 'runs', 'latest', '.stop'), '1')
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ ok: true }))
          })
        })

        server.middlewares.use('/api/runner-log', (req, res) => {
          import('fs').then(({ default: fs }) => {
            const logPath = path.join(__dirname, 'public', 'runs', 'latest', 'runner.log')
            try {
              const content = fs.readFileSync(logPath, 'utf8')
              res.setHeader('Content-Type', 'text/plain; charset=utf-8')
              res.end(content)
            } catch {
              res.setHeader('Content-Type', 'text/plain')
              res.end('(no log yet)')
            }
          })
        })
      }
    }
  ],
})
