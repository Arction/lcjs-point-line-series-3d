import { emptyFill, lightningChart, Point3D, PointSeriesTypes3D } from "@arction/lcjs"
import { createProgressiveTraceGenerator } from "@arction/xydata"

function addStyleSheet(styleString: string) {
    const style = document.createElement('style')
    style.textContent = styleString
    document.head.append(style)
}

// Generate a static YZ data-set for this series that repeats indefinitely along the X plane.
let data: { y: number, z: number }[] | undefined
const UNIQUE_DATA_POINTS = 10000
Promise.all([
    createProgressiveTraceGenerator()
        .setNumberOfPoints(UNIQUE_DATA_POINTS)
        .generate()
        .toPromise()
    ,
    createProgressiveTraceGenerator()
        .setNumberOfPoints(UNIQUE_DATA_POINTS)
        .generate()
        .toPromise()
]).then((dataSetsYZ) => {
    // Combine two data sets into one YZ data set.
    const dataSetXY = dataSetsYZ[0]
    const dataSetXZ = dataSetsYZ[1]
    return dataSetXY.map(( xy, i ) => ({
        y: xy.y,
        z: dataSetXZ[i].y
    }))
}).then((dataSet) => {
    // Repeat data set so that it can be looped indefinitely.
    data = dataSet.concat(dataSet.slice(1, -1).reverse())
})

const App = (
    /**
     * Type of Series to test.
     */
    seriesType: 'Point' | 'Line',

): () => unknown => {
    const chart = lightningChart().Chart3D({
        container: chartDiv
    })
        .setTitleFillStyle(emptyFill)
        // Set 3D bounding box dimensions to highlight X Axis. 
        .setBoundingBox({ x: 1.0, y: 0.5, z: 0.4 })
    
    const axisX = chart.getDefaultAxisX()
        .setScrollStrategy(undefined)

    chart.getDefaultAxisY()
        .setAnimationScroll(true)

    chart.getDefaultAxisZ()
        .setAnimationScroll(true)

    const series = seriesType === 'Point' ?
        // Select Triangulated Point Series for maximum geometry complexity.
        chart.addPointSeries({ type: PointSeriesTypes3D.Triangulated }) :
        chart.addLineSeries()

    // Add points every frame.
    let sub_addMorePoints
    let tLastFrame
    let pointsModulus = 0
    let x = 0
    let currentData: Point3D[] = []
    let dataAmount = 0
    const addMorePoints = () => {
        if (!data) {
            // Data is not ready yet.
        } else {
            const tNow = Date.now()
            if (tLastFrame !== undefined) {
                const tDeltaMs = tNow - tLastFrame
                let pointsToAdd = dataPointsPerSecond * (tDeltaMs / 1000) + pointsModulus
                pointsModulus = pointsToAdd - Math.floor(pointsToAdd)
                pointsToAdd = Math.floor(pointsToAdd)
    
                const points: Point3D[] = []
                for (let i = 0; i < pointsToAdd; i ++) {
                    // Pick YZ coordinates from data set.
                    const yz = data[x % data.length]
                    const point = {
                        x,
                        y: yz.y,
                        z: yz.z
                    }
                    currentData.push(point)
                    points.push(point)
                    x ++
                }
                dataAmount += points.length
                series.add(points)

                const visibleIntervalX = 2 * dataPointsPerSecond
                axisX.setInterval(x - visibleIntervalX, x, false, true)
            }
            tLastFrame = tNow
        }
        sub_addMorePoints = requestAnimationFrame(addMorePoints)
    }
    addMorePoints()

    // Schedule cleaning of old data.
    const checkCleanupOldData = () => {
        const minPointsToKeep = axisX.getInterval().end - axisX.getInterval().start
        if (currentData.length < minPointsToKeep) return
        const spliceStart = currentData.length - minPointsToKeep
        const spliceCount = Math.min(minPointsToKeep, currentData.length - spliceStart)
        const pointsToKeep = currentData.splice(spliceStart, spliceCount)
        series.clear().add(pointsToKeep)
        currentData = pointsToKeep
    }
    const sub_cleanupOldData = setInterval(checkCleanupOldData, 1000)

    // Update performance stats regularly.
    let tStart = Date.now()
    const updateStats = () => {
        // Calculate amount of incoming points / second.
        if (dataAmount > 0 && Date.now() - tStart > 0) {
            const pps = (1000 * dataAmount) / (Date.now() - tStart)
            ppsLabel.innerHTML = `${Math.round(pps)} incoming data points / s`
        }
        if (fps && fps > 0) {
            fpsLabel.innerHTML = `${fps.toFixed(1)} frames rendered / s`
        }
    }
    const sub_updateStats = setInterval(updateStats, 1000)

    // Measure FPS.
    let frames = 0
    let fps: number | undefined
    const recordFrame = () => {
        frames ++
        const tNow = Date.now()
        fps = 1000 / ((tNow - tStart) / frames)
        sub_measureFPS = requestAnimationFrame(recordFrame)
    }
    let sub_measureFPS = requestAnimationFrame(recordFrame)

    // Reset average counters every once in a while.
    let lastReset = Date.now()
    const sub_resetAvgCounters = setInterval(() => {
        tStart = lastReset = Date.now()
        dataAmount = 0
        frames = 0
    }, 5000)

    return () => {
        // Dispose Chart and remove event handlers.
        chart.dispose()
        cancelAnimationFrame(sub_addMorePoints)
        clearInterval(sub_cleanupOldData)
        clearInterval(sub_updateStats)
        cancelAnimationFrame(sub_measureFPS)
        clearInterval(sub_resetAvgCounters)
    }
}

// Add little HTML UI for selecting series / points per second.

addStyleSheet(`
body {
    margin: 0px 0px;
    overflow: hidden;
}

#selector-div {
    z-index: 10;
    color: white;
    position: fixed;
    top: 0px;
    left: 0px;
    width: 100vw;
    display: flex;
    flex-direction: row;
    align-items: center;
    white-space: nowrap;
}

@media only screen and (max-device-width: 480px) {
    #selector-div {
        flex-direction: column;
    }
}

#chart {
    height: 100vh;
}

#dataPointsRate {
    margin-left: 10px;
}

#pps {
    margin-left: 10px;
}

#fps {
    margin-left: 10px;
    margin-right: 10px;
}

`)

const div = document.createElement('div')
document.body.append(div)
div.innerHTML = `
<div>
    <input type="radio" id="points" name="seriesType" value="points" checked=true>
    <label for="points">Point Series 3D</label><br>
</div>
<div>
    <input type="radio" id="lines" name="seriesType" value="lines">
    <label for="lines">Line Series 3D</label><br>
</div>

<input type="range" min="0" max="100" value="10" class="slider" id="dataPointsRate">

<span id="pps"></span>
<span id="fps"></span>
`
div.id = 'selector-div'

const ppsLabel = document.getElementById('pps')
const fpsLabel = document.getElementById('fps')
const dataPointsRateSlider = document.getElementById('dataPointsRate') as HTMLInputElement


const chartDiv = document.createElement('div')
document.body.append(chartDiv)
chartDiv.id = 'chart'

let seriesType: 'Point' | 'Line' = 'Point'
let dataPointsPerSecond: number
let dispose: () => unknown | undefined
const updateApp = () => {
    if (dispose) dispose()
    dispose = App(seriesType)
}
updateApp()

document.getElementById('points').onchange = (e) => {
    seriesType = 'Point'
    updateApp()
}
document.getElementById('lines').onchange = (e) => {
    seriesType = 'Line'
    updateApp()
}

const updateDataPointsPerSecond = () => {
    // [0 - 100] -> [?]
    const sliderValue = Math.max(1, Number(dataPointsRateSlider.value))
    dataPointsPerSecond = Math.round(50 ** (1 + Math.log10(sliderValue)))
    console.log(`[TARGET = ${dataPointsPerSecond} data points per second]`)
}
updateDataPointsPerSecond()
dataPointsRateSlider.oninput = () => updateDataPointsPerSecond()
