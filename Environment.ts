import {Environment, Food, Obstacle, Position} from "./Interfaces"
import {Agent} from "./Agent"

export class BasicEnvironment implements Environment {
    constructor(
        public width: number, 
        public height: number,
        public obstacles: Obstacle[],
        public foods: Food[],
        public agents: Agent[],
        public foodGenerationCountdown: number,
        public foodGenerationCountdownMax: number,
    ){
        if(this.foodGenerationCountdown > this.foodGenerationCountdownMax){
            throw new Error("The value of the food generation countdown needs to be less than or equal to the value of the food generation countdown max.")
        }
    }
   
    update(): void {
        throw new Error("Method not implemented.");
    }

    // Maybe if its too slow we want to actually store position information in the environment rather than the enity
    getEntitiesInRadius(agent: Agent):{
        foods: Food[];
        agents: Agent[];
        obstacles: Obstacle[];
    } {

        const agents = this.getAgentsInRange(agent);
        const foods = this.getFoodsInRange(agent);
        const obstacles = this.getObstaclesInRange(agent);

        return {foods, agents, obstacles };
    }
  
    getAgentsInRange(agent: Agent): Agent[] {
        let agents: Agent[] = [];
        for (const otherAgent of this.agents) {
            if (otherAgent === agent) {
                continue;
            }
            if (this.isInRange(agent.position, agent.sensing_radius.value, otherAgent.position)) {
                agents.push(otherAgent);
            }
        }
        return agents;
    }

    getFoodsInRange(agent: Agent) : Food[] {
        let foods: Food[] = [];
        for (const food of this.foods) {
            if (this.isInRange(agent.position, agent.sensing_radius.value, food.position)) {
                foods.push(food);
            }
        }
        return foods;
    }

    
    getObstaclesInRange(agent: Agent): Obstacle[] {
        let obstacles: Obstacle[] = [];
        for (const food of this.foods) {
            if (this.isInRange(agent.position,  agent.sensing_radius.value, food.position)) {
                obstacles.push(food);
            }
        }
        return obstacles;
    }


    private isInRange( inCenter: Position, radius: number, positionToCheck: Position) {
        return positionToCheck.x < inCenter.x + radius
            && positionToCheck.x > inCenter.x - radius
            && positionToCheck.y < inCenter.y + radius
            && positionToCheck.y > inCenter.y - radius;
    }

    addAgent(agent: Agent): void {
        this.agents.push(agent)
    }

    removeFood(food: Food): void {
        const index = this.foods.indexOf(food);
        this.foods.splice(index, 1);

    }

    removeAgent(agent: Agent): void {
        const index = this.agents.indexOf(agent);
        this.agents.splice(index, 1);
    }

    createNewAgent(agent: Agent): void {
        this.agents.push(agent)
    }

}