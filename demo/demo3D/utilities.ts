import * as dat from 'dat.gui'
import Plotly from 'plotly.js-dist'
import { toPath } from 'svg-points'

import { getBBOXPoints, IBbox, IConfig2D, IConfig3D, IPolygon } from '../../src/helper'
import { extractPlanesAndPolygons } from '../../src/main'
// import {initializeCanvas} from './canvas'
// import {} from ''
// File URLS
const building1 = require('../../assets/data/building6_example2_360.csv')
const building2 = require('../../assets/data/building6_example2_90.csv')
const building3 = require('../../assets/data/building6_example_360.csv')
const building4 = require('../../assets/data/building6_example_90.csv')

const building5 = require('../../assets/data/building3_example_360.csv')
const building6 = require('../../assets/data/building3_example_90.csv')
const building7 = require('../../assets/data/building2_example3_360.csv')
const building8 = require('../../assets/data/building2_example3_90.csv')

const buildingURLS = [building1, building2, building3, building4, building5, building6, building7, building8]
export const buildingKeys = ['building1-360', 'building1-90', 'building2-360', 'building2-90',
                            'building3-360', 'building3-90', 'building4-360', 'building4-90',]

interface IRow {
  X: number
  Y: number
  Z: number
  C: number
}

export let DATA_ROWS: IRow[]
export let points2D
export let points4D


export const shellColor = '#008000'
export const holeColor = '#F67C3D'

// this object houses all configuration
const CONFIG = <IConfig3D>{
  file: buildingKeys[0],
  pointColor: 'class',
  // 2D filtering Options
  min_bbox_area: 100,
  xy_thresh: 3,
  dim: 4,
  min_triangles: 15,
  alpha: 0.5,
  // 3D Filtering Options
  z_thresh: 0.2,
  norm_thresh: 0.9,
  desired_vector: [0, 0, 1],
  // Vis Options
  drawTriangles: false,
  drawPoints: false,
  filterClass: true
}

const PLOTLY_DIV_3D = 'plotly-div-3d'
const PLOTLY_DIV_2D = 'plotly-div-2d'

const camera3D = {
  center: { x: 0, y: 0, z: 0 },
}

// Plotly 3D Scatter settings
const trace3DPoints = {
  mode: 'markers',
  x: [1],
  y: [1],
  z: [1],
  marker: {
    size: 5,
    // line: {
    //   color: 'rgba(217, 217, 217, 0.14)',
    //   width: 0.01,
    // },
    opacity: 0.5,
    color: [1],
    colorscale: 'Viridis',
  },
  type: 'scatter3d',
}

const data3DScatter = [trace3DPoints]

const layout3DScatter = {
  autosize: true,
  height: 500,
  title: '',
  font: { size: 12 },
  scene: {
    camera: camera3D,
  },
}

const layout2DShapes = {
  xaxis: {
    zeroline: false,
    autorange:true,
    range: [0,1]
  },
  yaxis: {
    showgrid: false,
    autorange:true,
    range: [0,1]
  },
  autosize: true,
  height: 500,
  shapes: [
    //Quadratic Bezier Curves

    {
      type: 'path',
      path: 'M 4,4 Q 6,0 8,4',
      line: {
        color: 'rgb(93, 164, 214)',
      },
    },

    //Cubic Bezier Curves

    {
      type: 'path',
      path: 'M 1,4 C 2,8 6,4 8,8',
      line: {
        color: 'rgb(207, 114, 255)',
      },
    },

    //Filled Triangle

    {
      type: 'path',
      path: 'M 1 1 L 1 3 L 4 1 Z',
      fillcolor: 'rgba(44, 160, 101, 0.5)',
      line: {
        color: 'rgb(44, 160, 101)',
      },
    },

    //Filled Polygon

    {
      type: 'path',
      path: ' M 3,7 L2,8 L2,9 L3,10, L4,10 L5,9 L5,8 L4,7 Z',
      fillcolor: 'rgba(255, 140, 184, 0.5)',
      line: {
        color: 'rgb(255, 140, 184)',
      },
    },
  ],
}

function updatePointsBuffer() {
  let n = DATA_ROWS.length
  points2D = []
  points4D = new Float64Array(n * 4)
  for (let i = 0; i < n; i++) {
    const p = DATA_ROWS[i]
    points2D.push([p.X, p.Y])

    points4D[i * 4] = p.X
    points4D[i * 4 + 1] = p.Y
    points4D[i * 4 + 2] = p.Z
    points4D[i * 4 + 3] = p.C
  }
}

const fileURLS = buildingKeys.map((file: string, index: number) => {
  return { id: file, url: buildingURLS[index] }
})

export const fileURLMapping = new Map(fileURLS.map(i => [i.id, i.url]))

function unpack(rows: Object[], key: string) {
  return rows.map(row => {
    return row[key]
  })
}

function loadCSV(fileURL: string) {
  function convertNumbers(row) {
    const r = {}
    for (const k in row) {
      r[k] = +row[k]
      if (isNaN(r[k])) {
        r[k] = row[k]
      }
    }
    return r
  }
  return new Promise((resolve, reject) => {
    Plotly.d3.csv(fileURL, convertNumbers, (error, request) => {
      if (error) {
        reject(error)
      } else {
        resolve(request)
      }
    })
  })
}

function drawTriangles(delaunay) {
  const triangles = delaunay.triangles
  const shapes = []
  for (let i = 0; i < triangles.length; i += 3) {
    const p0 = triangles[i]
    const p1 = triangles[i + 1]
    const p2 = triangles[i + 2]
    const piPath = [p0, p1, p2]
    const polyStr = poly2String(piPath, points2D)
    shapes.push(createShape(polyStr, '', '#000000'))
  }
  return shapes
}

function poly2String(shell: number[], points2D: number[][]) {
  const pathString = shell
    .map((pi: number) => {
      return `${points2D[pi][0].toFixed(6)},${points2D[pi][1].toFixed(6)}`
    })
    .join(' ')
  // console.log(pathString)
  const pathObject = {
    type: 'polygon',
    points: pathString
  }
  const svgString = toPath(pathObject)
  return svgString
}

function createShape(path:string, fillcolor:string='', linecolor:string=''){
  return {
    type: 'path',
    path: path,
    fillcolor: fillcolor,
    line: {
      color: linecolor
    }
  }
}

export function plot2DShapes(
  points2D: number[][],
  delaunay,
  planes,
  polygons: IPolygon[],
  config,
) {

  const bbox:IBbox = {xmax: Number.NEGATIVE_INFINITY, xmin: Number.POSITIVE_INFINITY, ymax: Number.NEGATIVE_INFINITY, ymin: Number.POSITIVE_INFINITY}
  const svgPolygons = polygons.map((poly: IPolygon) => {
    getBBOXPoints(poly.shell, delaunay, bbox)
    const shell = poly2String(poly.shell, points2D)
    const holes = poly.holes.map((poly: number[]) =>
    poly2String(poly, points2D),
    )
    return { shell: shell, holes: holes}
  })
  console.log(bbox)
  let shapes = []
  svgPolygons.forEach((svgPoly, index: number) => {
    shapes.push(createShape(svgPoly.shell, '', shellColor))
    svgPoly.holes.forEach(hole => shapes.push(createShape(hole,'',holeColor)))
  })
  // const triShapes = drawTriangles(delaunay)
  // shapes = shapes.concat(triShapes)

  layout2DShapes.xaxis.range = [bbox.xmin, bbox.xmax]
  layout2DShapes.yaxis.range = [bbox.ymin, bbox.ymax]
  layout2DShapes.shapes = shapes
  
  Plotly.react(PLOTLY_DIV_2D, undefined, layout2DShapes)
  
  // console.log(shapes)
}

export function plot3DScatter() {
  const rows = DATA_ROWS
  let x = unpack(rows, 'X')
  let y = unpack(rows, 'Y')
  let z = unpack(rows, 'Z')
  let c = unpack(rows, 'C')
  let maxZ = Math.max(...z)
  // camera3D.center = [0, 0, 0]
  layout3DScatter.scene.camera.center.z = 0.15

  trace3DPoints.x = x
  trace3DPoints.y = y
  trace3DPoints.z = z

  if (CONFIG.pointColor === 'class') {
    trace3DPoints.marker.color = c
  } else {
    trace3DPoints.marker.color = z
  }

  Plotly.react(PLOTLY_DIV_3D, data3DScatter, layout3DScatter, {
    responsive: true,
  })
}

window.addEventListener('resize', e => {
  updateAll(true)
})

function getConfig(config) {
  if (config.filterClass) {
    config.allowed_class = 4.0
  } else {
    config.allowed_class = undefined
  }
  return { ...config}
}

export function updateAll(pointsChanged = true) {
  if (pointsChanged) {
    plot3DScatter()
    updatePointsBuffer()
    window.points2D = points2D
  }
  // perform computation
  const config = getConfig(CONFIG)
  console.log(config)
  const [delaunay, planes, polygons] = extractPlanesAndPolygons(
    points2D,
    config,
    points4D,
  )
  plot2DShapes(points2D, delaunay, planes, polygons, config)
  // initializeCanvas(points2D, delaunay, planes, polygons, config)
}

export async function changeDataSource(value) {
  const url = fileURLMapping.get(value)
  DATA_ROWS = await loadCSV(url)
  updateAll()
}

export function initializeGUI() {
  const gui = new dat.GUI()
  const file = gui.add(CONFIG, 'file', buildingKeys)
  file.onChange(changeDataSource)

  const visFolder = gui.addFolder('Vis Options')
  visFolder
    .add(CONFIG, 'pointColor', ['height', 'class'])
    .name('Point Color')
    .onChange(plot3DScatter)
  visFolder
    .add(CONFIG, 'drawTriangles')
    .name('Draw Triangles')
    .onChange(() => updateAll(false))
  visFolder
    .add(CONFIG, 'drawPoints')
    .name('Draw Points')
    .onChange(() => updateAll(false))

  const configFolder = gui.addFolder('Algorithm Options')
  configFolder
    .add(CONFIG, 'min_bbox_area', 4, 100)
    .name('Min BBOX Area')
    .onChange(() => updateAll(false))
  configFolder
    .add(CONFIG, 'xy_thresh', 0.0, 5)
    .name('Max X/Y Dist')
    .onChange(() => updateAll(false))
  configFolder
    .add(CONFIG, 'min_triangles', 10, 50)
    .name('Min # of triangles for plane')
    .onChange(() => updateAll(false))
  configFolder.add(CONFIG, 'alpha', 0.01, 1.0).onChange(() => updateAll(false))
  configFolder
    .add(CONFIG, 'z_thresh', 0.1, 1)
    .name('Z Threshold')
    .onChange(() => updateAll(false))
  configFolder
    .add(CONFIG, 'norm_thresh', 0.8, 1.0)
    .onChange(() => updateAll(false))
  configFolder
    .add(CONFIG, 'filterClass')
    .name("Filter by Class")
    .onChange(() => updateAll(false))
  const customContainer = document.getElementById('my-gui-container')
  customContainer.appendChild(gui.domElement)
  return [gui, CONFIG]
}

export async function initializePlots() {
  await changeDataSource(buildingKeys[0])
}
