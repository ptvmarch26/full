'use strict'
const fs   = require('fs')
const path = require('path')
const crypto = require('crypto')

const DEMO_N    = parseInt(process.env.DEMO_N)    || 10
const DEMO_DEPTH = parseInt(process.env.DEMO_DEPTH) || 20
const ELECTION_ID = 'ELC2026'

const DATA_DIR   = path.join(__dirname, '..', 'data')
const OUT_DB      = path.join(DATA_DIR, 'voter_data_for_db_1000000.json')
const OUT_SECRETS = path.join(DATA_DIR, 'voter_secrets_for_script_1000000.json')

function posH(poseidon, inputs) {
  return poseidon.F.toObject(poseidon(inputs))
}

// Precompute empty-subtree hashes for zero padding
function buildEmptyHashes(poseidon, depth) {
  const e = [0n]
  for (let l = 1; l <= depth; l++) e.push(posH(poseidon, [e[l-1], e[l-1]]))
  return e
}

// Sparse Merkle tree: only materialises nodes reachable from real leaves
function buildSparseTree(poseidon, leaves, depth) {
  const empty = buildEmptyHashes(poseidon, depth)
  const N = leaves.length
  const nodes = Array.from({ length: depth + 1 }, () => new Map())

  for (let i = 0; i < N; i++) nodes[0].set(i, leaves[i])

  for (let l = 1; l <= depth; l++) {
    const parents = new Set()
    for (const [p] of nodes[l-1]) parents.add(p >> 1)
    for (const p of parents) {
      const L = nodes[l-1].get(p*2)   ?? empty[l-1]
      const R = nodes[l-1].get(p*2+1) ?? empty[l-1]
      nodes[l].set(p, posH(poseidon, [L, R]))
    }
  }

  const root = nodes[depth].get(0) ?? empty[depth]

  const proofs = leaves.map((_, i) => {
    const pathElements = [], pathIndices = []
    let pos = i
    for (let l = 0; l < depth; l++) {
      const isRight = pos & 1
      const sib = pos ^ 1
      pathElements.push(nodes[l].get(sib) ?? empty[l])
      pathIndices.push(isRight)
      pos >>= 1
    }
    return { pathElements, pathIndices }
  })

  return { root, proofs }
}

async function main() {
  const { buildBabyjub, buildPoseidon } = require('circomlibjs')

  console.log(`[gen_demo_voters] N=${DEMO_N} depth=${DEMO_DEPTH}`)

  const babyjub  = await buildBabyjub()
  const poseidon = await buildPoseidon()
  const { F, Base8: G, subOrder: n } = babyjub

  // Election hash: Poseidon of char-codes of ELECTION_ID
  const elecBytes  = Array.from(ELECTION_ID).map(c => BigInt(c.charCodeAt(0)))
  const electionHash = posH(poseidon, elecBytes).toString()

  const dbVoters  = []
  const secretVoters = []

  for (let i = 0; i < DEMO_N; i++) {
    // Random BabyJubJub private key
    let sk
    do {
      sk = BigInt('0x' + crypto.randomBytes(32).toString('hex'))
    } while (sk === 0n || sk >= n)

    const pkPoint = babyjub.mulPointEscalar(G, sk)
    const pkX = F.toObject(pkPoint[0])
    const pkY = F.toObject(pkPoint[1])

    const hashedKey = posH(poseidon, [pkX, pkY])
    const nullifier  = posH(poseidon, [sk, BigInt(electionHash)])

    dbVoters.push({ hashed_key: hashedKey.toString(), election_id: ELECTION_ID, is_valid: true, pk_secp: '0x00' })
    secretVoters.push({ hashed_key: hashedKey.toString(), sk_bjj: sk.toString(), pk_bjj: [pkX.toString(), pkY.toString()], pk_secp: '0x00', nullifier: nullifier.toString(), election_hash: electionHash })
  }

  const leaves = dbVoters.map(v => BigInt(v.hashed_key))
  const { root, proofs } = buildSparseTree(poseidon, leaves, DEMO_DEPTH)

  dbVoters.forEach((v, i) => {
    v.merkle_proof = {
      path_elements: proofs[i].pathElements.map(String),
      path_indices:  proofs[i].pathIndices.map(String),
    }
  })

  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(OUT_DB,      JSON.stringify([{ root: root.toString() }, ...dbVoters],  null, 2))
  fs.writeFileSync(OUT_SECRETS, JSON.stringify(secretVoters, null, 2))

  console.log(`[gen_demo_voters] root=${root.toString().slice(0,20)}... done.`)
}

main().catch(e => { console.error('[gen_demo_voters] FAILED:', e.message || e); process.exit(1) })
