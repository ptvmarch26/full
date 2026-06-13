const crypto = require('crypto')

async function uploadToIPFS(data) {
  try {
    const { create } = await import('kubo-rpc-client')
    const client = create({ url: 'http://127.0.0.1:5001' })
    const result = await client.add(data)
    return result.path
  } catch (_err) {
    // IPFS daemon unavailable — derive a deterministic mock CID so the demo
    // can continue without a running IPFS node.
    const content = typeof data === 'string' ? data : JSON.stringify(data)
    const hash = crypto.createHash('sha256').update(content).digest('hex')
    return `bafymockdemo${hash.slice(0, 28)}`
  }
}

module.exports = { uploadToIPFS }
