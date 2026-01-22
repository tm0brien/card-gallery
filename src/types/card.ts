export interface CardSubgrades {
    centering?: string
    corners?: string
    edges?: string
    surface?: string
}

export interface CardGrade {
    company: string
    score: string
    label?: string
    subgrades?: CardSubgrades
}

export interface CardData {
    title: string
    player: string
    year: string
    set: string
    cardNumber: string
    team: string
    manufacturer?: string
    grade: CardGrade
    certificationNumber: string
    notes?: string
}

export interface CameraPreset {
    name: string
    position: [number, number, number]
    target: [number, number, number]
}
