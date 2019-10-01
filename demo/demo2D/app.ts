// This code is modified from Delaunator website

import Delaunator from 'delaunator'

import { concaveHullTest } from '../../src/d3concave'
import { pointList2Edge, pointsOfTriangle, IPolygon } from '../../src/helper'
import { extractConcaveHulls, extractPlanes } from '../../src/main'

import { points } from './points'

let delaunay = Delaunator.from(points)
window.delaunay = delaunay

let canvas = document.getElementById('canvas')
let ctx = canvas.getContext('2d')

let minX = Infinity
let minY = Infinity
let maxX = -Infinity
let maxY = -Infinity
const PX_BUFFER = 10
const THROTTLE_LIMIT = 1
const AXES_STEPS = 30

for (let i = 0; i < points.length; i++) {
  const x = points[i][0]
  const y = points[i][1]
  if (x < minX) minX = x
  if (y < minY) minY = y
  if (x > maxX) maxX = x
  if (y > maxY) maxY = y
}

let padding = 20
let w = 1024
let h = 1024

let planes: number[][] = []
let concaveHulls: number[][] = []

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
canvas.style.width = w + 'px'
canvas.style.height = h + 'px'

canvas.width = w
canvas.height = h

if (window.devicePixelRatio >= 2) {
  canvas.width = w * 2
  canvas.height = h * 2
  ctx.scale(2, 2)
}

let ratio = (w - 2 * padding) / Math.max(maxX - minX, maxY - minY)

ctx.lineJoin = 'round'
ctx.lineCap = 'round'

window.updated = true
window.points = points

canvas.addEventListener("touchmove", (e) => {
  const touch = e.touches[0];
  const mouseEvent = new MouseEvent("mousemove", {
    clientX: touch.clientX,
    clientY: touch.clientY
  })
  canvas.dispatchEvent(mouseEvent)
}, {passive:true})


// Get the position of a touch relative to the canvas
function getTouchPos(canvasDom, touchEvent) {
  var rect = canvasDom.getBoundingClientRect();
  return {
    x: touchEvent.touches[0].clientX - rect.left,
    y: touchEvent.touches[0].clientY - rect.top
  };
}


function mouse_over(e) {
  points.push([
    (e.layerX - padding) / ratio + minX,
    (e.layerY - padding) / ratio + minY,
  ])
  console.time('delaunay')
  delaunay = Delaunator.from(points)
  console.timeEnd('delaunay')
  window.updated = true
}

canvas.onmousemove = _.throttle(mouse_over, THROTTLE_LIMIT)

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

function frame() {
  requestAnimationFrame(frame)
  draw()
}
frame()

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
      drawPlane(plane, color)

      const outerShell = pointList2Edge(polygon.shell, delaunay)
      drawEdges(outerShell, shellColor, 5, false)
      for (const hole of polygon.holes) {
        const innerHole = pointList2Edge(hole, delaunay)
        drawEdges(innerHole, holeColor, 5, false)
      }
    }
  }
}

function drawPlane(plane, color) {
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

function drawAxes() {
  const xRange = maxX - minX
  const xStep = xRange / AXES_STEPS
  const yRange = maxY - minY
  const yStep = yRange / AXES_STEPS

  const tickSize = 0.01
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
      getYPad(maxY) + padding,
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

function draw() {
  if (!window.updated) return
  window.updated = false

  ctx.clearRect(0, 0, w, h)

  drawAxes()



  const config = {
    min_bbox_area: 1000.0,
    xy_thresh: 20.0,
    dim: 2,
    min_triangles: 15,
    alpha: 0.0,
  }

  console.time('Extract Planes')
  planes = extractPlanes(delaunay, config, points)
  console.timeEnd('Extract Planes')

  console.time('Concave Hull Extraction')
  const concaveList = extractConcaveHulls(planes, delaunay, config)
  console.timeEnd('Concave Hull Extraction')
  console.log(`# Points: ${points.length}`)
  console.log(concaveList)
  drawPlanesAndHull(planes, concaveList)

  let triangles = delaunay.triangles

  // Triangles
  ctx.beginPath()
  ctx.fillStyle = 'black'
  for (let i = 0; i < triangles.length; i += 3) {
    let p0 = triangles[i]
    let p1 = triangles[i + 1]
    let p2 = triangles[i + 2]
    let pc = getCentroid(points[p0], points[p1], points[p2])
    ctx.moveTo(getX(p0), getY(p0))
    ctx.lineTo(getX(p1), getY(p1))
    ctx.lineTo(getX(p2), getY(p2))
    ctx.fillText((i / 3).toString(), getXPad(pc[0]), getYPad(pc[1]))
    ctx.closePath()
  }
  ctx.strokeStyle = 'black'
  ctx.lineWidth = 0.5
  ctx.stroke()
  // ctx.fillStyle = 'rgba(255,255,0,0.1)';
  // ctx.fill();

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
  ctx.fillStyle = 'black'
  ctx.beginPath()
  for (let i = 0; i < points.length; i++) {
    ctx.rect(getX(i) - 1.5, getY(i) - 1.5, 3, 3)
  }
  ctx.fill()

}
