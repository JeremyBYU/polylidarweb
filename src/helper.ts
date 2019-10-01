import Delaunator from 'delaunator'

// Type Declarations

export interface IConfig2D {
  dim: number
  xy_thresh?: number
  alpha?: number

  min_triangles: number
  min_bbox_area: number
}

export interface IConfig3D extends IConfig2D {
  z_thresh: number
  norm_thresh: number
  desired_vector: [number, number, number],
  points?: Float64Array
}

export interface IConfig4D extends IConfig3D {
  allowed_class: number
}

export interface IPolygon {
  shell: number[]
  holes: number[][]
}

export interface IBbox {
  xmin: number
  xmax: number
  ymin: number
  ymax: number
}

export type IValidateTriangle = (
  t: number,
  delaunay: Delaunator<number>,
  points?: any,
) => boolean

export const enum ConcaveResult {
  Shell = 0,
  Hole = 1,
  Placeholder = 2,
  Broken = 3,
}

export type TriHash = {
  [details: number]: number
}

export type NumberHash = {
  [details: number]: number
}

export type ArrayHash = {
  [details: number]: number[]
}

export interface IExtremePoint {
  xr: {
    he: number
    val: number
    pi: number
  }
  xl: {
    he: number
    val: number
    pi: number
  }
}

export const enum ItemState {
  Unexplored = 0,
  Explored = 1,
  Invalid = 2,
}

// Helper Functions

function getVector(
  edge: number,
  delaunay: Delaunator<number>,
  flip: boolean = false,
): [number, number] {
  const coords = delaunay.coords
  const triangles = delaunay.triangles
  const pi = triangles[edge]
  const p0 = [coords[pi * 2], coords[pi * 2 + 1]]

  const piNext = triangles[nextHalfedge(edge)]
  const p1 = [coords[piNext * 2], coords[piNext * 2 + 1]]

  if (flip) {
    return [p0[0] - p1[0], p0[1] - p1[1]]
  } else {
    return [p1[0] - p0[0], p1[1] - p0[1]]
  }
}

function get360Angle(v1: [number, number], v2: [number, number]) {
  const dot = dotProduct(v1, v2)
  const det = determinant(v1, v2)
  let ang = Math.atan2(det, dot)
  if (ang < 0) {
    ang += Math.PI * 2
  }

  return ang
}

export function bboxArea(bbox: IBbox) {
  return Math.abs(bbox.xmax - bbox.xmin) * Math.abs(bbox.ymax - bbox.ymin)
}

export function getBBOXPoints(
  pointIndices: number[],
  delaunay: Delaunator<number>,
  bbox: IBbox,
) {
  const coords = delaunay.coords
  pointIndices.forEach(pi => {
    const x = coords[pi * 2]
    const y = coords[pi * 2 + 1]

    if (x < bbox.xmin) {
      bbox.xmin = x
    } else if (x > bbox.xmax) {
      bbox.xmax = x
    }

    if (y < bbox.ymin) {
      bbox.ymin = y
    } else if (y > bbox.ymax) {
      bbox.ymax = y
    }
  })
}

export function getBboxPlane(
  planePatch: number[],
  delaunay: Delaunator<number>,
): IBbox {
  const triangles = delaunay.triangles

  const bbox = {
    xmin: Number.POSITIVE_INFINITY,
    ymin: Number.POSITIVE_INFINITY,
    xmax: Number.NEGATIVE_INFINITY,
    ymax: Number.NEGATIVE_INFINITY,
  }
  for (const t of planePatch) {
    const pointIndices = edgesOfTriangle(t).map((e: number) => triangles[e])
    getBBOXPoints(pointIndices, delaunay, bbox)
  }

  return bbox
}

export function getHullEdge(
  incomingEdge: number,
  outgoingEdges: number[],
  delaunay: Delaunator<number>,
  isHole: boolean = false,
) {

  if (outgoingEdges.length > 2) {
    console.warn("More than 2 Hull edges!")
  }
  // turn incoming edge into a vector
  // vector should face opposite direction
  const v1 = getVector(incomingEdge, delaunay, true)
  // turn outgoing edges into a vector, dont invert
  const otherVectors = outgoingEdges.map((edge: number) =>
    getVector(edge, delaunay, false),
  )
  // Measure angle (between 0 and 360 degrees) between vectors
  const angleDist = otherVectors.map(outVector => {
    return get360Angle(v1, outVector)
  })
  // Select vector with smallest angle difference
  let edgeIndex = 0
  if (isHole) {
    edgeIndex = angleDist.indexOf(Math.min(...angleDist))
  } else {
    edgeIndex = angleDist.indexOf(Math.max(...angleDist))
  }

  return outgoingEdges[edgeIndex]
}

export function edgesOfTriangle(t: number): [number, number, number] {
  return [t * 3, t * 3 + 1, t * 3 + 2]
}

export function triangleOfEdge(e: number): number {
  return Math.floor(e / 3)
}

export function pointsOfTriangle(delaunay: Delaunator<number>, t: number) {
  return edgesOfTriangle(t).map((e: number) => delaunay.triangles[e])
}

export function trianglesAdjacentToTriangle(
  delaunay: Delaunator<number>,
  t: number,
): number[] {
  const adjacentTriangles = []
  for (const e of edgesOfTriangle(t)) {
    const opposite = delaunay.halfedges[e]
    if (opposite >= 0) {
      adjacentTriangles.push(triangleOfEdge(opposite))
    }
  }

  return adjacentTriangles
}

export function nextHalfedge(e: number) {
  return e % 3 === 2 ? e - 2 : e + 1
}

export function prevHalfedge(e: number) {
  return e % 3 === 0 ? e + 2 : e - 1
}

function determinant(v1: [number, number], v2: [number, number]) {
  return v1[0] * v2[1] - v1[1] * v2[0]
}

export function norm(v1: [number, number]): number {
  return Math.sqrt(Math.pow(v1[0], 2) + Math.pow(v1[1], 2))
}

function dotProduct(v1: [number, number], v2: [number, number]) {
  return v1[0] * v2[0] + v1[1] * v2[1]
}

export function dotProduct3(v1: [number, number, number], v2: [number, number, number]) {
  return v1[0] * v2[0] + v1[1] * v2[1] + v1[2] * v2[2]
}

export function triangleNormal(vv1:[number, number, number], vv2:[number, number, number], vv3: [number, number, number]): [number, number, number] {
  const u1 = vv2[0] - vv1[0]
  const u2 = vv2[1] - vv1[1]
  const u3 = vv2[2] - vv1[2]

  const v1 = vv3[0] - vv1[0]
  const v2 = vv3[1] - vv1[1]
  const v3 = vv3[2] - vv1[2]

  // # print(u1, u2, u3, v1, v2, v3)
  const ans = [0,0, 0]
  ans[0] = u2 * v3 - u3 * v2
  ans[1] = u3 * v1 - u1 * v3
  ans[2] = u1 * v2 - u2 * v1

  const normTemp = Math.sqrt(ans[0] * ans[0] + ans[1] * ans[1] + ans[2] * ans[2])
  return [ans[0] / normTemp, ans[1] / normTemp, ans[2] / normTemp]
}

function pi2Cord(pi: number, coords: Float64Array) {
  return [coords[pi * 2], coords[pi * 2 + 1]]
}

export function pointList2Edge(
  pointList: number[],
  delaunay: Delaunator<number>,
) {
  const coords = delaunay.coords
  const edges = []
  for (let i = 0; i < pointList.length - 1; i++) {
    const p1 = pointList[i]
    const p2 = pointList[i + 1]
    edges.push([pi2Cord(p1, coords), pi2Cord(p2, coords)])
  }
  edges.push([
    pi2Cord(pointList[pointList.length - 1], coords),
    pi2Cord(pointList[0], coords),
  ])

  return edges
}
