import Delaunator from 'delaunator'
import Denque from 'denque'

// Type imports
import {
  ArrayHash,
  IConfig2D,
  IConfig3D,
  IConfig4D,
  IExtremePoint,
  IPolygon,
  ItemState,
  IValidateTriangle,
  NumberHash,
  TriHash,
} from './helper'

import {
  bboxArea,
  dotProduct3,
  getBboxPlane,
  getHullEdge,
  nextHalfedge,
  norm,
  pointsOfTriangle,
  triangleNormal,
  trianglesAdjacentToTriangle,
} from './helper'

function instanceOfConfig3D(
  object: IConfig2D | IConfig3D,
): object is IConfig3D {
  return 'z_thresh' in object
}

function instanceOfConfig4D(
  object: IConfig2D | IConfig3D | IConfig4D,
): object is IConfig4D {
  return 'allowed_class' in object
}

function circumscribedRadius(points: number[][]) {
  const pa = points[0]
  const pb = points[1]
  const pc = points[2]
  const aLength = norm([pa[0] - pb[0], pa[1] - pb[1]])
  const bLength = norm([pb[0] - pc[0], pb[1] - pc[1]])
  const cLength = norm([pc[0] - pa[0], pc[1] - pa[1]])
  const s = (aLength + bLength + cLength) / 2.0

  const area = Math.sqrt(s * (s - aLength) * (s - bLength) * (s - cLength))
  return (aLength * bLength * cLength) / (area * 4.0)
}

function validateTriangle2D(config: IConfig2D): IValidateTriangle {
  // @ts-ignore
  function validateTriangle2DClosure(
    t: number,
    delaunay: Delaunator<number>,
    _pointsOrig?: any,
  ) {
    const coords = delaunay.coords
    const points = pointsOfTriangle(delaunay, t).map((p: number) => {
      return [coords[p * 2], coords[p * 2 + 1]]
    })
    if (config.xy_thresh) {
      if (
        Math.abs(points[0][0] - points[1][0]) > config.xy_thresh ||
        Math.abs(points[0][1] - points[1][1]) > config.xy_thresh
      ) {
        return false
      }
      if (
        Math.abs(points[0][0] - points[2][0]) > config.xy_thresh ||
        Math.abs(points[0][1] - points[2][1]) > config.xy_thresh
      ) {
        return false
      }
      if (
        Math.abs(points[1][0] - points[2][0]) > config.xy_thresh ||
        Math.abs(points[1][1] - points[2][1]) > config.xy_thresh
      ) {
        return false
      }
    }

    if (config.alpha && circumscribedRadius(points) > 1.0 / config.alpha) {
      return false
    }

    return true
  }

  return validateTriangle2DClosure
}

function validateTriangle3D(config: IConfig3D): IValidateTriangle {
  // @ts-ignore
  const validator2D = validateTriangle2D(config)
  function validateTriangle3DClosure(
    t: number,
    delaunay: Delaunator<number>,
    pointsAll?: any,
  ) {
    if (!validator2D(t, delaunay, pointsAll)) {
      return false
    }

    const points = pointsOfTriangle(delaunay, t).map((p: number) => {
      return [
        pointsAll[p * config.dim],
        pointsAll[p * config.dim + 1],
        pointsAll[p * config.dim + 2],
      ]
    })

    // Check if zThresh is met, then automatically allow the triangle
    if (config.z_thresh) {
      const zMin = Math.min(points[0][2], points[1][2], points[2][2])
      const zMax = Math.max(points[0][2], points[1][2], points[2][2])
      const diff = zMax - zMin
      // We return early here, normal filtering doesn't apply
      if (diff < config.z_thresh) {
        return true
      }
    }

    if (config.norm_thresh) {
      const normal = triangleNormal(points[0], points[1], points[2])
      const dotProd = Math.abs(dotProduct3(normal, config.desired_vector))
      if (dotProd < config.norm_thresh) {
        return false
      }
    }

    return true
  }

  return validateTriangle3DClosure
}

function validateTriangle4D(config: IConfig4D): IValidateTriangle {
  // @ts-ignore
  const validator3D = validateTriangle3D(config)
  function validateTriangle4DClosure(
    t: number,
    delaunay: Delaunator<number>,
    pointsAll?: any,
  ) {
    // Get all class points
    const pointsClass = pointsOfTriangle(delaunay, t).map((p: number) => {
      return pointsAll[p * config.dim + 3]
    })
    // Get all class
    if (config.allowed_class !== undefined) {
      if (!pointsClass.every(pc => pc === config.allowed_class)) {
        return false
      }
    }

    if (!validator3D(t, delaunay, pointsAll)) {
      return false
    }
    return true
  }
  return validateTriangle4DClosure
}

function createTriangleHash(
  delaunay: Delaunator<number>,
  triValidator: IValidateTriangle,
  pointsAll: any,
): TriHash {
  const numTriangles = Math.floor(delaunay.triangles.length / 3)
  const triHash: TriHash = {}
  for (let t = 0; t < numTriangles; t++) {
    if (triValidator(t, delaunay, pointsAll)) {
      triHash[t] = ItemState.Unexplored
    }
  }

  return triHash
}

function extractMeshHash(
  delaunay: Delaunator<number>,
  triHash: TriHash,
  seedIdx: number,
) {
  // Create a new queue for triangle expansion
  const queue = new Denque<number>()
  // Push the seed idx on queue and remove from open set
  queue.push(seedIdx)
  // Delete from hash
  delete triHash[seedIdx]

  const candidates: number[] = []
  while (!queue.isEmpty()) {
    const tri = queue.pop()
    candidates.push(tri)
    const unexploredNeighbors = trianglesAdjacentToTriangle(
      delaunay,
      tri,
    ).filter((triangle: number) => triHash[triangle] !== undefined)
    for (const triangleNeighbor of unexploredNeighbors) {
      queue.push(triangleNeighbor)
      delete triHash[triangleNeighbor]
    }
  }

  return candidates
}

export function applyPlaneConstraints(
  planePatch: number[],
  config: IConfig2D | IConfig3D,
  delaunay: Delaunator<number>,
) {
  if (planePatch.length < config.min_triangles) {
    return false
  }
  const bbox = getBboxPlane(planePatch, delaunay)
  if (bboxArea(bbox) < config.min_bbox_area) {
    return false
  }
  return true
}

export function create_planes(
  delaunay: Delaunator<number>,
  config: IConfig2D | IConfig3D,
  triValidator: IValidateTriangle,
  pointsAll: any,
) {
  // Create hash map
  // const numTriangles = Math.floor(delaunay.triangles.length / 3)
  const triHash = createTriangleHash(delaunay, triValidator, pointsAll)

  let triKeys = []
  const allPlanes: number[][] = []
  while (true) {
    triKeys = Object.keys(triHash)
    if (triKeys.length < 1) {
      break
    }
    const seedIdx = parseFloat(triKeys[0])
    // const seedIdx = triKeys[0]
    const planePatch = extractMeshHash(delaunay, triHash, seedIdx)
    if (applyPlaneConstraints(planePatch, config, delaunay)) {
      allPlanes.push(planePatch)
    }
  }

  return allPlanes
}

export function extractPlanes(
  delaunay: Delaunator<number>,
  config: IConfig2D | IConfig2D | IConfig4D,
  pointsAll?: any,
): number[][] {
  // Check input dimension
  let planes: number[][] = []
  let triangleValidator = validateTriangle2D(config)

  if (instanceOfConfig4D(config)) {
    triangleValidator = validateTriangle4D(config)
  } else if (instanceOfConfig3D(config)) {
    triangleValidator = validateTriangle3D(config)
  } 
  planes = create_planes(delaunay, config, triangleValidator, pointsAll)

  return planes
}

function maxPoint(
  pi: number,
  delaunay: Delaunator<number>,
  extremePoint: IExtremePoint,
  he: number,
) {
  const points = delaunay.coords

  if (points[pi * 2] > extremePoint.xr.val) {
    extremePoint.xr.val = points[pi * 2]
    extremePoint.xr.he = he
    extremePoint.xr.pi = pi
  }

  if (points[pi * 2] < extremePoint.xl.val) {
    extremePoint.xl.val = points[pi * 2]
    extremePoint.xl.he = he
    extremePoint.xl.pi = pi
  }
}

function constructPointHash(
  plane: number[],
  delaunay: Delaunator<number>,
): [ArrayHash, NumberHash, NumberHash, IExtremePoint] {
  const triangles = delaunay.triangles
  const halfedges = delaunay.halfedges
  // all incoming half edges to a point index
  const pointHash: ArrayHash = {}
  // all valid triangles
  const triHash: NumberHash = {}
  // outgoing point indices
  const edgeHash: NumberHash = {}

  // create a hash of the triangles
  for (let i = 0; i < plane.length; i++) {
    triHash[plane[i]] = ItemState.Explored
  }

  const extremePoint = {
    xr: {
      he: undefined,
      val: Number.NEGATIVE_INFINITY,
      pi: undefined,
    },
    xl: {
      he: undefined,
      val: Number.POSITIVE_INFINITY,
      pi: undefined,
    },
  }

  // Loop through every triangle in plane
  for (let k = 0; k < plane.length; k++) {
    // convert triangle index to starting edge index
    const heIndex = plane[k] * 3
    // iterate through all edges of triangle
    for (let j = 0; j < 3; j++) {
      // get correct edge offset
      const he = heIndex + j
      // get edge of ADJACENT triangle
      const oppHe = halfedges[he]
      // Check if adjacent triangle is NOT in our plane mesh
      if (oppHe === -1 || triHash[Math.floor(oppHe / 3)] === undefined) {
        // Record this edge
        edgeHash[he] = ItemState.Explored
        // Get the point that corresponds to the START of this edge
        const pi = triangles[he]
        // Check if this point is the right most extreme point
        maxPoint(pi, delaunay, extremePoint, he)

        // If this is not the first time we have seen this point, create a new array and push it to
        // the point hash, else just append it
        if (pointHash[pi] !== undefined) {
          pointHash[pi].push(he)
        } else {
          pointHash[pi] = [he]
        }
      }
    }
  }
  // We have returned a point hash, a triangle hash, and edgeHash, and the edge/point that is farthest to right

  return [pointHash, triHash, edgeHash, extremePoint]
}

function concaveSection(
  pointHash: ArrayHash,
  edgeHash: NumberHash,
  delaunay: Delaunator<number>,
  startEdge: number,
  stopPoint: number,
  isHole: boolean = false,
): number[] {
  const triangles = delaunay.triangles
  // const coords = delaunay.coords
  let workingEdge = startEdge

  // hull section that will be extracted, a collection of point INDICES
  const hullSection: number[] = []

  // This will only find one concave hull on mesh
  while (true) {
    delete edgeHash[workingEdge]
    // Get the next EDGE of the SAME triangle
    const nextHalfEdge = nextHalfedge(workingEdge)
    // Get the starting point of this edge
    const nextPi = triangles[nextHalfEdge]
    // console.log(`Expanding point ${delaunay.coords[2 * nextPi]}, ${delaunay.coords[2 * nextPi + 1]} `)
    // Add point to hull section
    hullSection.push(nextPi)

    if (nextPi === stopPoint) {
      return hullSection
    }

    // Get outgoing edges for this point
    // filter edges that have already been seen!
    let nextEdges = pointHash[nextPi]
    if (nextEdges === undefined || nextEdges.length === 0) {
      console.error("Error! Possibly incorrect edge labeled as part of the concave hull")
      return []
    }
    nextEdges = nextEdges.filter(edge => edgeHash[edge] !== undefined)
    if (nextEdges.length === 1) {
      workingEdge = nextEdges[0]
    } else {
      const newEdge = getHullEdge(workingEdge, nextEdges, delaunay, isHole)
      workingEdge = newEdge
    }
  }
}

function extractInteriorHoles(
  pointHash: ArrayHash,
  edgeHash: NumberHash,
  delaunay: Delaunator<number>,
) {
  const triangles = delaunay.triangles
  // Check if there are leftover **interior** holes of this mesh
  // We will be using the same extract concave section to get these holes
  const allHoles = []
  let edgeKeys = Object.keys(edgeHash)
  if (edgeKeys.length == 1){
    return allHoles
  }
  while (1) {
    edgeKeys = Object.keys(edgeHash)
    if (edgeKeys.length === 0) {
      break
    }
    const startEdge = parseFloat(edgeKeys[0])
    const startingPointIndex = triangles[startEdge]
    const stopPoint = startingPointIndex

    // note the true argument at end. This tells the concave section that this edge is hole edge
    const hole = concaveSection(
      pointHash,
      edgeHash,
      delaunay,
      startEdge,
      stopPoint,
      false,
    )
    allHoles.push(hole)
  }

  return allHoles
}

export function extractConcaveHull(
  plane: number[],
  delaunay: Delaunator<number>,
  _config?: IConfig2D | IConfig2D,
): IPolygon {
  if (plane.length < 1) {
    return undefined
  }
  // @ts-ignore
  const [pointHash, triHash, edgeHash, extremePoint] = constructPointHash(
    plane,
    delaunay,
  )
  const startingHalfEdge = extremePoint.xr.he
  const startingPointIndex = extremePoint.xr.pi
  const stopPoint = startingPointIndex
  const shell = concaveSection(
    pointHash,
    edgeHash,
    delaunay,
    startingHalfEdge,
    stopPoint,
    false,
  )
  const interiorHoles = extractInteriorHoles(pointHash, edgeHash, delaunay)

  return { shell: shell, holes: interiorHoles }
}

export function extractConcaveHulls(
  planes: number[][],
  delaunay: Delaunator<number>,
  config: IConfig2D | IConfig3D,
): IPolygon[] {
  // Each plane will be a polygon with possible holes in it
  const concaveHulls: IPolygon[] = []
  for (const plane of planes) {
    const cHull = extractConcaveHull(plane, delaunay, config)
    concaveHulls.push(cHull)
  }

  return concaveHulls
}

export function extractPlanesAndPolygons(
  points: number[][],
  config: IConfig2D | IConfig3D,
  pointsAll?: any,
): [Delaunator<number>, number[][], IPolygon[]] {
  console.log(`Points Length: ${points.length}`)
  console.time('Delaunay')
  const delaunay = Delaunator.from(points)
  console.timeEnd('Delaunay')

  console.time('Extract Planes')
  const planes = extractPlanes(delaunay, config, pointsAll)
  console.timeEnd('Extract Planes')

  console.time('Extract Polygons')
  const polygons = extractConcaveHulls(planes, delaunay, config)
  console.timeEnd('Extract Polygons')

  return [delaunay, planes, polygons]
}
