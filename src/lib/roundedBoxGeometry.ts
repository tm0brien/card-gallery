import * as THREE from 'three'
import { toCreasedNormals } from 'three-stdlib'

const EPS = 1e-5

/**
 * Rounded box geometry with 6 material groups matching BoxGeometry face ordering:
 * 0 = +X (right), 1 = -X (left), 2 = +Y (top), 3 = -Y (bottom), 4 = +Z (front), 5 = -Z (back).
 * UVs are projected per-face to [0,1] matching BoxGeometry conventions.
 */
export function createRoundedBoxGeometry(
    width: number,
    height: number,
    depth: number,
    radius: number,
    smoothness = 4,
    creaseAngle = 0.4
): THREE.BufferGeometry {
    radius = Math.min(radius, Math.min(width, height, depth) / 2)

    const shape = new THREE.Shape()
    const r = radius - EPS
    shape.absarc(EPS, EPS, r, -Math.PI / 2, -Math.PI, true)
    shape.absarc(EPS, height - radius * 2, r, Math.PI, Math.PI / 2, true)
    shape.absarc(width - radius * 2, height - radius * 2, r, Math.PI / 2, 0, true)
    shape.absarc(width - radius * 2, EPS, r, 0, -Math.PI / 2, true)

    const extruded = new THREE.ExtrudeGeometry(shape, {
        depth: depth - radius * 2,
        bevelEnabled: true,
        bevelSegments: smoothness * 2,
        steps: 1,
        bevelSize: radius - EPS,
        bevelThickness: radius,
        curveSegments: smoothness,
    })

    extruded.center()
    toCreasedNormals(extruded, creaseAngle)

    // Non-indexed so each triangle owns its vertices — avoids UV conflicts at edges
    const geom = extruded.toNonIndexed()
    extruded.dispose()

    const pos = geom.attributes.position as THREE.BufferAttribute
    const nrm = geom.attributes.normal as THREE.BufferAttribute
    const triCount = pos.count / 3

    const e1 = new THREE.Vector3()
    const e2 = new THREE.Vector3()
    const fn = new THREE.Vector3()
    const va = new THREE.Vector3()
    const vb = new THREE.Vector3()
    const vc = new THREE.Vector3()

    // Classify each triangle by geometric face normal
    const triGroup: number[] = []
    for (let t = 0; t < triCount; t++) {
        const i = t * 3
        va.fromBufferAttribute(pos, i)
        vb.fromBufferAttribute(pos, i + 1)
        vc.fromBufferAttribute(pos, i + 2)
        e1.subVectors(vb, va)
        e2.subVectors(vc, va)
        fn.crossVectors(e1, e2)

        if (fn.lengthSq() < 1e-10) {
            triGroup.push(4)
            continue
        }
        fn.normalize()

        const ax = Math.abs(fn.x)
        const ay = Math.abs(fn.y)
        const az = Math.abs(fn.z)
        if (ax >= ay && ax >= az) triGroup.push(fn.x > 0 ? 0 : 1)
        else if (ay >= ax && ay >= az) triGroup.push(fn.y > 0 ? 2 : 3)
        else triGroup.push(fn.z > 0 ? 4 : 5)
    }

    // Sort triangles so each material group is contiguous
    const order = Array.from({ length: triCount }, (_, i) => i)
    order.sort((a, b) => triGroup[a] - triGroup[b])

    const vCount = pos.count
    const newPos = new Float32Array(vCount * 3)
    const newNrm = new Float32Array(vCount * 3)
    const newUV = new Float32Array(vCount * 2)
    const hw = width / 2
    const hh = height / 2
    const hd = depth / 2

    for (let oi = 0; oi < order.length; oi++) {
        const src = order[oi]
        const g = triGroup[src]
        for (let v = 0; v < 3; v++) {
            const si = src * 3 + v
            const di = oi * 3 + v
            const px = pos.getX(si)
            const py = pos.getY(si)
            const pz = pos.getZ(si)

            newPos[di * 3] = px
            newPos[di * 3 + 1] = py
            newPos[di * 3 + 2] = pz
            newNrm[di * 3] = nrm.getX(si)
            newNrm[di * 3 + 1] = nrm.getY(si)
            newNrm[di * 3 + 2] = nrm.getZ(si)

            let fu: number
            let fv: number
            switch (g) {
                case 0: fu = (hd - pz) / depth;  fv = (py + hh) / height; break
                case 1: fu = (pz + hd) / depth;  fv = (py + hh) / height; break
                case 2: fu = (px + hw) / width;  fv = (hd - pz) / depth;  break
                case 3: fu = (px + hw) / width;  fv = (pz + hd) / depth;  break
                case 4: fu = (px + hw) / width;  fv = (py + hh) / height; break
                case 5: fu = (hw - px) / width;  fv = (py + hh) / height; break
                default: fu = 0; fv = 0
            }
            newUV[di * 2] = clamp01(fu)
            newUV[di * 2 + 1] = clamp01(fv)
        }
    }

    geom.setAttribute('position', new THREE.BufferAttribute(newPos, 3))
    geom.setAttribute('normal', new THREE.BufferAttribute(newNrm, 3))
    geom.setAttribute('uv', new THREE.BufferAttribute(newUV, 2))

    // Build material groups
    const groupCounts = [0, 0, 0, 0, 0, 0]
    for (const t of order) groupCounts[triGroup[t]]++

    geom.clearGroups()
    let start = 0
    for (let g = 0; g < 6; g++) {
        if (groupCounts[g] > 0) {
            geom.addGroup(start, groupCounts[g] * 3, g)
            start += groupCounts[g] * 3
        }
    }

    return geom
}

function clamp01(v: number): number {
    return Math.max(0, Math.min(1, v))
}
