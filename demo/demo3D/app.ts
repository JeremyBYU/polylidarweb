// function

import * as dat from 'dat.gui'
import Plotly from 'plotly.js-dist'

import {fileURLMapping, initializeGUI, initializePlots} from './utilities'




window.addEventListener('load', () => {

  const [gui, config] = initializeGUI()
  initializePlots()
})




