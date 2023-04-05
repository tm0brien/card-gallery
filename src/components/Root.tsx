import { OrbitControls } from '@react-three/drei'
import { Canvas, useLoader } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { Mesh, sRGBEncoding } from 'three'
import { TextureLoader } from 'three/src/loaders/TextureLoader.js'

function Box(props: any) {
    // This reference gives us direct access to the THREE.Mesh object
    const ref = useRef<Mesh>()

    // Hold state for hovered and clicked events
    const [, hover] = useState(false)
    const [clicked, click] = useState(false)

    // // Subscribe this component to the render-loop, rotate the mesh every frame
    // useFrame((state, delta) => {
    //     if (ref.current) {
    //         ref.current.rotation.x += 0
    //     }
    // })

    const texFront = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/front.png')
    const texBack = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/back.png')
    const texLeft = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/left.png')
    const texRight = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/right.png')
    const texTop = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/top.png')
    const texBottom = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/bottom.png')

    texFront.encoding = sRGBEncoding
    texBack.encoding = sRGBEncoding
    texTop.encoding = sRGBEncoding
    texBottom.encoding = sRGBEncoding
    texLeft.encoding = sRGBEncoding
    texRight.encoding = sRGBEncoding

    const roughDimensions = [6100, 3800, 400]

    return (
        <mesh
            {...props}
            ref={ref}
            onClick={() => click(!clicked)}
            onPointerOver={() => hover(true)}
            onPointerOut={() => hover(false)}
        >
            <boxGeometry args={[roughDimensions[0] / 1600, roughDimensions[1] / 1600, roughDimensions[2] / 1600]} />
            <meshStandardMaterial map={texTop} attach="material-0" />
            <meshStandardMaterial map={texBottom} attach="material-1" />
            <meshStandardMaterial map={texLeft} attach="material-2" />
            <meshStandardMaterial map={texRight} attach="material-3" />
            <meshStandardMaterial map={texFront} attach="material-4" color={'white'} />
            <meshStandardMaterial map={texBack} attach="material-5" />
        </mesh>
    )
}

const Root: React.FC = () => {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <Canvas>
                <ambientLight intensity={0.1} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} />
                <pointLight position={[-10, -10, -10]} />
                <Box position={[0, 0, 0]} />
                <OrbitControls enablePan={true} minDistance={0.5} maxDistance={16} />
            </Canvas>
        </div>
    )
}

export default Root
