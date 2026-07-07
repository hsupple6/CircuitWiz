/** Minimal KiCad S-expression parser for .kicad_sym / .kicad_mod files. */

function tokenize(source) {
  const tokens = []
  let i = 0
  while (i < source.length) {
    const ch = source[i]
    if (ch === ';') {
      while (i < source.length && source[i] !== '\n') i++
      continue
    }
    if (ch === '(' || ch === ')') {
      tokens.push(ch)
      i++
      continue
    }
    if (ch === '"' ) {
      let j = i + 1
      let value = ''
      while (j < source.length) {
        if (source[j] === '\\' && j + 1 < source.length) {
          value += source[j + 1]
          j += 2
          continue
        }
        if (source[j] === '"') break
        value += source[j]
        j++
      }
      tokens.push(value)
      i = j + 1
      continue
    }
    if (/\s/.test(ch)) {
      i++
      continue
    }
    let j = i
    while (j < source.length && !/\s/.test(source[j]) && source[j] !== '(' && source[j] !== ')') j++
    tokens.push(source.slice(i, j))
    i = j
  }
  return tokens
}

function parseList(tokens, pos) {
  const items = []
  pos.index++
  while (pos.index < tokens.length && tokens[pos.index] !== ')') {
    items.push(parseNode(tokens, pos))
  }
  if (tokens[pos.index] === ')') pos.index++
  return items
}

function parseNode(tokens, pos) {
  const token = tokens[pos.index]
  if (token === '(') {
    return parseList(tokens, pos)
  }
  pos.index++
  return token
}

function parse(source) {
  const tokens = tokenize(source)
  const pos = { index: 0 }
  return parseNode(tokens, pos)
}

function atom(node) {
  return typeof node === 'string' ? node : null
}

function listHead(node) {
  return Array.isArray(node) && node.length > 0 ? atom(node[0]) : null
}

function findProperty(tree, name) {
  if (!Array.isArray(tree)) return ''
  for (const child of tree) {
    if (!Array.isArray(child)) continue
    if (listHead(child) === 'property' && atom(child[1]) === name) {
      return atom(child[2]) ?? ''
    }
  }
  return ''
}

function findAll(node, head) {
  const results = []
  function walk(n) {
    if (!Array.isArray(n)) return
    if (listHead(n) === head) results.push(n)
    for (const child of n) {
      if (Array.isArray(child)) walk(child)
    }
  }
  walk(node)
  return results
}

module.exports = { parse, atom, listHead, findProperty, findAll }
