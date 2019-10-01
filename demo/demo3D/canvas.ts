import Delaunator from 'delaunator'

import { pointList2Edge, pointsOfTriangle, IPolygon } from '../../src/helper'

// Will hold the 2D points
let points:number[][]
let points4D:Float64Array
window.updated = false


const padding = 20
const w = 400
let h

// const h = 500
// let w
let ratio

let canvas
let ctx

let delaunay
let planes
let polygons
let config

let minX = Infinity
let minY = Infinity
let maxX = -Infinity
let maxY = -Infinity

const PX_BUFFER = 10
const AXES_STEPS = 10

const colorPalette = [
  '#4878d0',
  '#ee854a',
  '#6acc64',
  '#d65f5f',
  '#956cb4',
  '#8c613c',
  '#dc7ec0',
  '#797979',
  '#d5bb67',
  '#82c6e2',
]

function updateExtent(points) {
  for (let i = 0; i < points.length; i++) {
    const x = points[i][0]
    const y = points[i][1]
    if (x < minX) {
      minX = x
    }
    if (y < minY) {
      minY = y
    }
    if (x > maxX) {
      maxX = x
    }
    if (y > maxY) {
      maxY = y
    }
  }
  h = (w - padding * 2) * (maxY - minY) / (maxX - minX) + padding * 2
  canvas.style.width = w + 'px'
  canvas.style.height = h + 'px'
  canvas.width = w
  canvas.height = h

  ratio = (w - padding * 2) / Math.max(maxX - minX, maxY - minY)
}


export function initializeCanvas(points2D:number[][], delaunay, planes, polygons, config) {
  points = points2D
  canvas = document.getElementById('canvas')
  ctx = canvas.getContext('2d')

  updateExtent(points)
  draw(delaunay, planes, polygons, config)
  
}

function getCentroid(p0, p1, p2) {
  return [(p0[0] + p1[0] + p2[0]) / 3, (p0[1] + p1[1] + p2[1]) / 3]
}

function getXPad(val) {
  return padding + ratio * (val - minX)
}

function getYPad(val) {
  return padding + ratio * (val - minY)
}

function getX(i) {
  return getXPad(points[i][0])
}
function getY(i) {
  return getYPad(points[i][1])
}


function drawAxes() {
  const xRange = maxX - minX
  const xStep = xRange / AXES_STEPS
  const yRange = maxY - minY
  const yStep = yRange / AXES_STEPS

  const tickSize = 0.03
  const xTickSize = Math.floor(yRange * tickSize)
  const yTickSize = Math.floor(xRange * tickSize)

  ctx.beginPath()
  ctx.fillStyle = 'black'
  ctx.strokeStyle = 'black'
  for (let x = Math.ceil(minX); x <= minX + xRange; x += xStep) {
    const xVal = Math.floor(x)
    ctx.moveTo(getXPad(xVal), getYPad(maxY) + padding / 2)
    ctx.lineTo(getXPad(xVal), getYPad(maxY))
    ctx.fillText(
      xVal.toFixed(1),
      getXPad(xVal - yTickSize),
      getYPad(maxY) + padding - 2,
    )
    ctx.closePath()
  }

  for (let y = minY; y <= minY + yRange; y += yStep) {
    const yVal = Math.floor(y)
    ctx.moveTo(getXPad(minX) - padding / 2, getYPad(yVal))
    ctx.lineTo(getXPad(minX), getYPad(yVal))
    ctx.save()
    ctx.translate(getXPad(minX) - padding - 1, getYPad(yVal + xTickSize))
    ctx.rotate(-Math.PI / 2)
    ctx.fillText(yVal.toFixed(1), 0, PX_BUFFER)
    ctx.restore()
    ctx.closePath()
  }
  ctx.stroke()
}


function drawEdges(
  edges,
  edgeColor: string = '#2EAC36',
  linewidth: number = 5.0,
  dashed: boolean = false,
) {
  ctx.strokeStyle = edgeColor
  ctx.lineWidth = linewidth
  if (dashed) {
    ctx.setLineDash([5, 15])
  } else {
    ctx.setLineDash([])
  }
  for (const edge of edges) {
    ctx.beginPath()
    const p0 = edge[0]
    const p1 = edge[1]
    ctx.moveTo(getXPad(p0[0]), getYPad(p0[1]))
    ctx.lineTo(getXPad(p1[0]), getYPad(p1[1]))
    ctx.stroke()
  }
  ctx.setLineDash([])
}

function drawPlanesAndHull(
  planes,
  hulls: IPolygon[],
  delaunay,
  shellColor = '#008000',
  holeColor = '#F67C3D',
) {
  if (planes.length !== hulls.length) {
    console.error('Planes and Hull should be equal')
  } else {
    for (let i = 0; i < planes.length; i++) {
      const plane = planes[i]
      const polygon = hulls[i]
      const colorIndex = i % 10
      const color = colorPalette[i]
      drawPlane(plane, color, delaunay)

      const outerShell = pointList2Edge(polygon.shell, delaunay)
      drawEdges(outerShell, shellColor, 5, false)
      for (const hole of polygon.holes) {
        const innerHole = pointList2Edge(hole, delaunay)
        drawEdges(innerHole, holeColor, 5, false)
      }
    }
  }
}

function drawPlane(plane, color, delaunay) {
  const triangles = delaunay.triangles
  ctx.beginPath()
  for (const t of plane) {
    const tindex = t * 3
    const p0 = triangles[tindex]
    const p1 = triangles[tindex + 1]
    const p2 = triangles[tindex + 2]
    ctx.moveTo(getX(p0), getY(p0))
    ctx.lineTo(getX(p1), getY(p1))
    ctx.lineTo(getX(p2), getY(p2))
    ctx.closePath()
  }
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineWidth = 0.5
  ctx.stroke()
  ctx.fill()
}

function draw(delaunay, planes, polygons, config) {

  ctx.clearRect(0, 0, w, h)

  drawAxes()

  drawPlanesAndHull(planes, polygons, delaunay)


  const triangles = delaunay.triangles

  // Triangles
  if (config.drawTriangles) {
    ctx.beginPath()
    ctx.fillStyle = 'black'
    for (let i = 0; i < triangles.length; i += 3) {
      const p0 = triangles[i]
      const p1 = triangles[i + 1]
      const p2 = triangles[i + 2]
      const pc = getCentroid(points[p0], points[p1], points[p2])
      ctx.moveTo(getX(p0), getY(p0))
      ctx.lineTo(getX(p1), getY(p1))
      ctx.lineTo(getX(p2), getY(p2))
      // ctx.fillText((i / 3).toString(), getXPad(pc[0]), getYPad(pc[1]))
      ctx.closePath()
    }
    ctx.strokeStyle = 'black'
    ctx.lineWidth = 0.5
    ctx.stroke()
  }


  // Hull
  ctx.beginPath()
  for (const i of delaunay.hull) {
    ctx.lineTo(getX(i), getY(i))
  }
  ctx.closePath()
  ctx.lineWidth = 1
  ctx.strokeStyle = 'red'
  ctx.stroke()

  // Points
  if (config.drawPoints) {
    ctx.fillStyle = 'black'
    ctx.beginPath()
    for (let i = 0; i < points.length; i++) {
      ctx.rect(getX(i) - 1.5, getY(i) - 1.5, 3, 3)
    }
    ctx.fill()
  }
}
