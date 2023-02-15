import {Agent} from "./Agent"

export interface Position {
    x: number;
    y: number;
}

export interface Entity {
    id: number; 
    position: Position;
    environment: Environment;
}

export interface Food extends Entity{
    nutrition: number
}

export interface Obstacle extends Entity {
}

export interface HasBehaviour{
    update():void;
}

export interface Environment extends HasBehaviour{
    readonly width: number;
    readonly height: number;
    readonly obstacles: Obstacle[];
    readonly foodGenerationCountdownMax: number;
    foodGenerationCountdown: number;
    foods: Food[];
    agents: Agent[];
    
    getEntitiesInRadius(agent: Agent): ({
        foods: Food[];
        agents: Agent[];
        obstacles: Obstacle[];
    });
    removeFood(food:Food): void;
    removeAgent(agent:Agent):void;
    addAgent(agent:Agent): void;
    getFoodsInRange(agent: Agent) : Food[];
    getAgentsInRange(agent: Agent): Agent[]
}
