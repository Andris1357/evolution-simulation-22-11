import {BasicEnvironment} from "./Environment"
import {Food, Obstacle, Entity as EntityInterface, Environment, HasBehaviour} from "./Interfaces"

import * as d3 from 'd3';

type InteractableEntity = Agent | Food

interface Position {
    x: number,
    y: number
}

interface Gene {
    value: number
    is_dominant: boolean
}

export class Agent implements HasBehaviour, EntityInterface {
    static id_generator: IterableIterator<number>

    constructor(
        public readonly id: number,
        public readonly environment: Environment,
        public position: Position,
        public readonly speed: Gene, // random int until a cap that is uniform for all instances
        public readonly sensing_radius: Gene, // random int until a cap that is uniform for all instances
        public readonly chance_for_mating_incentive: Gene, // random float between 0 & 1
        public readonly ticks_alive_without_food: Gene, // random int until a cap that is uniform for all instances
        public readonly potential_highest_age: Gene, // random int until a cap that is uniform for all instances
        public readonly chance_of_mutation_per_attribute: Gene, // random float between 0 & 1
        public readonly max_excess_fat: Gene, // Measured in ticks that nutritional value covers
        public current_age: number,
        public current_ticks_without_food: number, // Can be negative if excess fat is stored
        public readonly metabolism: number = 20 // A Food with 1 nutritional value reduces the value of current_ticks_without_food by 20
    ) {
        Agent.id_generator = Agent.nextEntityId()
    }

    static *nextEntityId(): IterableIterator<number> {
        let next_id: number = 0;
        while (true) {
            yield ++next_id
        }
    }

    update(): void {
        this.current_age++;
        this.current_ticks_without_food++;

        if ( // Will the instance die in this tick because it is too old or malnourished?
            this.current_age > this.potential_highest_age.value 
            || this.current_ticks_without_food > this.ticks_alive_without_food.value
        ) {
            this.environment.removeAgent(this)
            return
        } 
        
        for (var i = 0; i < this.speed.value; i++) { // Can perform a number of actions limited by its speed

            let incentive_to_eat: number = this.calculateIncentiveToEat()
            let incentive_to_reproduce: number = this.calculateIncentiveToReproduce()

            let selected_in_case_of_draw: boolean[] = [false, false];
            if (incentive_to_eat !== 0 && incentive_to_eat == incentive_to_reproduce) {
                selected_in_case_of_draw[Math.floor(Math.random() * 2)] = true;
            }
            
            if (selected_in_case_of_draw[0] === true || incentive_to_eat > incentive_to_reproduce) { // $incentive_to_eat is non-zero, thus entities of this type exist in radius
                let nearby_foods: Food[] = this.listEntitiesNearby(this.environment.foods);

                if (nearby_foods.length > 0) {
                    let target_position: Position = Agent.generateRandomMove(nearby_foods.map(
                        food_ => [food_.position.x, food_.position.y]
                    ))
                    
                    this.eatFood(nearby_foods.filter(
                        food_ => food_.position.x == target_position.x && food_.position.y == target_position.y
                    )[0]) // Only one food will exist at any selected position
                    this.move(target_position)
                }
                else { // If there are no objects in proximity, target the closest and start moving towards it
                    this.moveTowardsClosestEntity(this.environment.getFoodsInRange)
                }
            }
            else if (selected_in_case_of_draw[1] === true || incentive_to_eat < incentive_to_reproduce) { // $incentive_to_reproduce is non-zero, thus entities of this type exist in radius
                let nearby_agents: Agent[] = this.listEntitiesNearby(this.environment.agents)

                if (nearby_agents.length > 0) {
                    let target_position: Position = Agent.generateRandomMove(nearby_agents.map(
                        agent_ => [agent_.position.x, agent_.position.y]
                    ))
                    let target_agent: Agent = nearby_agents.filter(
                        agent_ => agent_.position.x == target_position.x && agent_.position.y == target_position.y
                    )[0]
                    
                    // Roll a probability that answers whether the other agent wants to reproduce too, if not, this is a null action
                    if (Agent.outcomeRepresentingProbability(target_agent.chance_for_mating_incentive.value)) {
                        Agent.createOffspring(this, target_agent)    
                    }
                }
                else {
                    this.moveTowardsClosestEntity(this.environment.getAgentsInRange)
                }
            }
            else { // No incentive for any special action
                this.move()
            }
        }
    
    }

    calculateIncentiveToEat(): number {
        if (this.environment.getFoodsInRange(this).length > 0 && !(
            this.max_excess_fat.value < -this.current_ticks_without_food // Only will be true if agent was overnourished because then $current_ticks_without_food is negative
        )) {
            return this.ticks_alive_without_food.value / this.ticks_alive_without_food.value
        }
        else {
            return 0
        }
    }

    calculateIncentiveToReproduce(): number {
        if (this.environment.getAgentsInRange(this).length > 0) {
            return this.chance_for_mating_incentive.value
        }
        else {
            return 0
        }
    }

    listEntitiesNearby<Type extends InteractableEntity>(entity_collection_: Type[]): Type[] {
        let nearby_targets: number[][] = this.generateAllMoveCombinations();
        return entity_collection_.filter(
            entity_ => nearby_targets.some(
                coordinate_pair_ => entity_.position.x == coordinate_pair_[0] && entity_.position.y == coordinate_pair_[1]
            )
        )
    }

    // ezt szinte biztos hogy le lehet rövidebben írni
    generateAllMoveCombinations(): number[][] {
        return Array.from(
            [-1, 0, 1],
            move_x_ => Array.from(
                [-1, 0, 1],
                move_y_ => [this.position.x + move_x_, move_y_ + this.position.y]
            )
        ).flatMap(x => x)
    }

    static generateRandomMove(enabled_combinations_: number[][]): Position {
        let selected: number[] = enabled_combinations_[Math.floor(
            Math.random() * enabled_combinations_.length
        )]
        return {
            x: selected[0],
            y: selected[1]
        }
    }

    eatFood(food_: Food) {
        this.current_ticks_without_food -= food_.nutrition * this.metabolism; // Later can add metabolism gene to enable conversion between the length of how long 1 unit of nutrition lasts and speed of instance
        this.environment.removeFood(food_);
    }


    move(exists_target_: Position | false = false): void { // 8 possible directions + chance for not moving
        if (exists_target_ === false) { // Moves randomly
            let possible_targets: number[][] = this.possibleMoveTargets();
            this.position = Agent.generateRandomMove(possible_targets);
        }
        else {
            this.position = exists_target_
        }
    }

    possibleMoveTargets(): number[][] {
        let all_combinations: number[][] = this.generateAllMoveCombinations();
        return all_combinations.filter(
            target_ => this.isTargetRouteBlocked({
                x: target_[0],
                y: target_[1]
            })
        )
    }

    isTargetRouteBlocked(target_position_: Position): boolean {
        return Agent.existsEntityAtLocation(this.environment.obstacles, target_position_) 
            && Agent.existsEntityAtLocation(this.environment.agents, target_position_)
    }

    static existsEntityAtLocation(collection_: Agent[] | Obstacle[] | Food[], target_position_: Position): boolean {
        return collection_.some(
            object_ => object_.position.x == target_position_.x && object_.position.y == target_position_.y
        )
    }
    
    moveTowardsClosestEntity(get_entity_function_: (this_agent_: Agent) => InteractableEntity[]): void {
        let closest_entity: Agent | Food = this.getClosestEntityInRadius(get_entity_function_)
        let possible_move_targets: Position[] = this.possibleMoveTargets().map(combination_ => {
            return {
                x: combination_[0],
                y: combination_[1]
            }
        })
        let target_position: Position = possible_move_targets.reduce(
            (previous_, current_) => this.getDistanceFrom(
                closest_entity.position, 
                previous_
            ) > this.getDistanceFrom(
                closest_entity.position, 
                current_
            ) ? current_ : previous_
        )

        this.move(target_position)
    }

    getClosestEntityInRadius<Type extends InteractableEntity>(
        get_entity_function_: (this_agent_: Agent) => Type[]
    ): InteractableEntity {
        let entities_in_radius: Type[] = get_entity_function_(this)
        return entities_in_radius.reduce(this.findEntityClosestCallback)
    }
    
    findEntityClosestCallback<Type extends InteractableEntity>(previous_: Type, current_: Type): Type {
        return this.getDistanceFrom(previous_) > this.getDistanceFrom(current_) ? current_ : previous_
    }

    getDistanceFrom(object_: InteractableEntity | Position, prospective_position_: Position | false = false): number {
        let reference_x: number = prospective_position_ === false ? this.position.x : prospective_position_.x
        let reference_y: number = prospective_position_ === false ? this.position.y : prospective_position_.y
        
        if (object_ as InteractableEntity) {
            return Math.pow(
                Math.pow(reference_x - (object_ as InteractableEntity).position.x, 2)
                + Math.pow(reference_y - (object_ as InteractableEntity).position.y, 2),
                0.5
            )
        }
        else {
            return Math.pow(
                Math.pow(reference_x - (object_ as Position).x, 2)
                + Math.pow(reference_y - (object_ as Position).y, 2),
                0.5
            )
        }
    }

    static outcomeRepresentingProbability(probability_: number): boolean {
        let representation_of_chance: boolean[] = Array.from(
            {length: 1000},
            (_, index_) => index_ < Math.round(probability_ * 1000)
        )
        return representation_of_chance[Math.floor(Math.random() * 1000)]
    }

    static createOffspring(agent_1_: Agent, agent_2_: Agent) {
        let chance_of_mutation: number = (
            agent_1_.chance_of_mutation_per_attribute.value
            + agent_2_.chance_of_mutation_per_attribute.value
        ) / 2;

        agent_1_.environment.addAgent(new Agent(
            Agent.id_generator.next().value,
            agent_1_.environment,
            Agent.generateRandomMove(agent_1_.possibleMoveTargets().concat(agent_2_.possibleMoveTargets())),
            Agent.outcomeRepresentingProbability(chance_of_mutation) 
                ? {
                    value: Math.ceil(Math.random() * 10), 
                    is_dominant: true
                }
                : Agent.mergeGenes(agent_1_.speed, agent_2_.speed),
            Agent.outcomeRepresentingProbability(chance_of_mutation) 
                ? {
                    value: Agent.generateNormallyDistributedRandom(Math.min(
                        agent_1_.environment.width, 
                        agent_1_.environment.height
                    ) / 2, 8, 1.2),
                    is_dominant: true
                } 
                : Agent.mergeGenes(agent_1_.sensing_radius, agent_2_.sensing_radius),
            Agent.outcomeRepresentingProbability(chance_of_mutation) 
                ? {
                    value: Number(Math.random().toFixed(4)),
                    is_dominant: true
                }
                : Agent.mergeGenes(agent_1_.chance_for_mating_incentive, agent_2_.chance_for_mating_incentive),
            Agent.outcomeRepresentingProbability(chance_of_mutation) 
                ? {
                    value: Agent.generateNormallyDistributedRandom(false, 50, 1.5),
                    is_dominant: true
                }
                : Agent.mergeGenes(agent_1_.ticks_alive_without_food, agent_2_.ticks_alive_without_food),
            Agent.outcomeRepresentingProbability(chance_of_mutation) 
                ? {
                    value: Agent.generateNormallyDistributedRandom(false, 5000, 2.5),
                    is_dominant: true
                }
                : Agent.mergeGenes(agent_1_.potential_highest_age, agent_2_.potential_highest_age),
            Agent.outcomeRepresentingProbability(chance_of_mutation) 
                ? {
                    value: Number(Math.random().toFixed(4)),
                    is_dominant: true
                }
                : Agent.mergeGenes(agent_1_.chance_of_mutation_per_attribute, agent_2_.chance_of_mutation_per_attribute),
            Agent.outcomeRepresentingProbability(chance_of_mutation) 
                ? {
                    value: Agent.generateNormallyDistributedRandom(false, 0, 0.8),
                    is_dominant: true
                }
                : Agent.mergeGenes(agent_1_.chance_of_mutation_per_attribute, agent_2_.chance_of_mutation_per_attribute),
            0,
            0
        ))
    }

    static mergeGenes(gene_1_: Gene, gene_2_: Gene): Gene {
        if (gene_1_.is_dominant == gene_2_.is_dominant) {
            return {
                value: [gene_1_.value, gene_2_.value][Math.floor(Math.random() * 2)],
                is_dominant: gene_1_.is_dominant
            }
        } 
        else {
            let dominant_gene: Gene = [...arguments].filter(gene_ => gene_.is_dominant)[0]
            return {
                value: dominant_gene.value,
                is_dominant: dominant_gene.is_dominant
            }
        }
    }

    static generateNormallyDistributedRandom( // Returns int values for mutating some of the genes
        highest_allowed_value_: number | false, 
        mean_: number, 
        standard_deviation_: number
    ): number {
        let generated_number: number = d3.randomNormal(mean_, standard_deviation_)();
        if (generated_number < 0) {
            return 1
        }
        else if (typeof(highest_allowed_value_) == "number" && generated_number > highest_allowed_value_) {
            return highest_allowed_value_ // ? Change this to [this value] - [normally distributed random number] because this way there may be too many highest values
        }
        else {
            return Math.ceil(generated_number)
        }
    }

}