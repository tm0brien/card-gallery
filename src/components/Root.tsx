import { OrbitControls } from '@react-three/drei'
import { Canvas, useLoader } from '@react-three/fiber'
import { useRef, useState } from 'react'
import { TextureLoader } from 'three/src/loaders/TextureLoader.js'
import { Mesh } from 'three/src/objects/Mesh'

function Box(props: any) {
    // This reference gives us direct access to the THREE.Mesh object
    const ref = useRef<Mesh>(null)

    // Hold state for hovered and clicked events
    const [, hover] = useState(false)
    const [clicked, click] = useState(false)

    const texFront = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/front.png')
    const texBack = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/back.png')
    const texLeft = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/left.png')
    const texRight = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/right.png')
    const texTop = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/top.png')
    const texBottom = useLoader(TextureLoader, 'assets/1955-aaron-bowman-bgs-55/bottom.png')

    const textures = [texFront, texBack, texTop, texBottom, texLeft, texRight]
    textures.forEach(texture => {
        texture.colorSpace = 'srgb'
    })

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
            <meshStandardMaterial attach={`material-0`}>
                <primitive attach="map" object={texTop} />
            </meshStandardMaterial>
            <meshStandardMaterial attach={`material-1`}>
                <primitive attach="map" object={texBottom} />
            </meshStandardMaterial>
            <meshStandardMaterial attach={`material-2`}>
                <primitive attach="map" object={texLeft} />
            </meshStandardMaterial>
            <meshStandardMaterial attach={`material-3`}>
                <primitive attach="map" object={texRight} />
            </meshStandardMaterial>
            <meshStandardMaterial attach={`material-4`}>
                <primitive attach="map" object={texFront} />
            </meshStandardMaterial>
            <meshStandardMaterial attach={`material-5`}>
                <primitive attach="map" object={texBack} />
            </meshStandardMaterial>
        </mesh>
    )
}

const Root: React.FC = () => {
    return (
        <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
            <Canvas>
                <ambientLight intensity={1.8} />
                <spotLight position={[10, 10, 10]} angle={0.15} penumbra={1} intensity={1.5} />
                <pointLight position={[-10, -10, -10]} intensity={1} />
                <Box position={[0, 0, 0]} />
                <OrbitControls enablePan={true} minDistance={0.5} maxDistance={16} />
            </Canvas>
        </div>
    )
}

export default Root
