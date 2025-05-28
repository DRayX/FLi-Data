function isString(value) {
    return typeof value === 'string' || value instanceof String;
}
async function loadData(path, func) {
    const result = new Map();
    const response = await fetch(path);
    if (response.ok) {
        const data = await response.json();
        const map = data[0].Properties?.m_dataMap;
        if (map) {
            for (let entry of map) {
                const key = isString(entry.Key) ? entry.Key : entry.Key.Name;
                result.set(key, await func(entry.Value));
            }
        }
    }
    return result;
}
function getProperty(map, prop) {
    return prop == 'None' ? null : map.get(prop) || null;
}
class BaseData {
    constructor(data) {
        this.raw = data;
    }
}
class TextData extends BaseData {
    static async load(path, text_field, lang_field) {
        return loadData(path, async (data) => {
            let text = new TextData(data);
            text.text = data[text_field].length ? data[text_field][0][lang_field] : null;
            return text;
        });
    }
}
class ItemData extends BaseData {
    constructor() {
        super(...arguments);
        this.tables = [];
        this.material_for = [];
        this.created_by = [];
    }
    static async load(path, names, descs) {
        return await loadData(path, async (data) => {
            const item = new ItemData(data);
            item.name = getProperty(names, data.nameId);
            item.desc = getProperty(descs, data.DescId);
            return item;
        });
    }
}
class ItemTableDetail extends BaseData {
    constructor(data, table, items) {
        super(data);
        this.table = table;
        this.item = getProperty(items, data.ItemId);
        if (this.item) {
            this.item.tables.push(this);
        }
    }
}
class ItemTableSetting extends BaseData {
    constructor() {
        super(...arguments);
        this.groups = [];
    }
    static async load(path, items) {
        return await loadData(path, async (data) => {
            const table = new ItemTableSetting(data);
            table.data = data.tableData.map(item => new ItemTableDetail(item, table, items));
            return table;
        });
    }
}
class ItemTableGroupData extends BaseData {
    constructor(data, group, tables) {
        super(data);
        this.group = group;
        this.table = getProperty(tables, data.tableId);
        if (this.table) {
            this.table.groups.push(this);
        }
    }
}
class ItemTableGroupSetting extends BaseData {
    constructor() {
        super(...arguments);
        this.pick_params = [];
        this.vegetable_params = [];
        this.enemies = [];
    }
    static async load(path, tables) {
        return await loadData(path, async (data) => {
            const group = new ItemTableGroupSetting(data);
            group.data = data.tableData.map(item => new ItemTableGroupData(item, group, tables));
            return group;
        });
    }
}
class CommonPickParamData extends BaseData {
    constructor() {
        super(...arguments);
        this.params = [];
    }
    static async load(path, groups) {
        return await loadData(path, async (data) => {
            const param = new CommonPickParamData(data);
            param.drop = getProperty(groups, data.Drop.tableGroupId);
            if (param.drop) {
                param.drop.pick_params.push(param);
            }
            return param;
        });
    }
}
class VegetableParamData extends BaseData {
    constructor() {
        super(...arguments);
        this.params = [];
    }
    // todo: drops
    static async load(path, groups) {
        return await loadData(path, async (data) => {
            const param = new VegetableParamData(data);
            return param;
        });
    }
}
class PickParamData extends BaseData {
    constructor() {
        super(...arguments);
        this.groups = [];
    }
    static async load(path, common_params, fishing_params, vegetable_params) {
        return await loadData(path, async (data) => {
            const param = new PickParamData(data);
            param.common = getProperty(common_params, data.commonPickDataId);
            if (param.common) {
                param.common.params.push(param);
            }
            param.fishing = getProperty(fishing_params, data.fishingParamDataId);
            if (param.fishing) {
                param.fishing.params.push(param);
            }
            param.vegetable = getProperty(vegetable_params, data.vegetableParamDataId);
            if (param.fishing) {
                param.fishing.params.push(param);
            }
            return param;
        });
    }
}
class PickPointGroupData extends BaseData {
    constructor(data, group, params) {
        super(data);
        this.group = group;
        this.param = getProperty(params, data.paramId);
        if (this.param) {
            this.param.groups.push(this);
        }
    }
}
class PickPointGroup extends BaseData {
    constructor() {
        super(...arguments);
        this.maps = [];
    }
    static async load(path, params) {
        return loadData(path, async (data) => {
            const group = new PickPointGroup(data);
            group.data = data.groupData.map(item => new PickPointGroupData(item, group, params));
            return group;
        });
    }
}
class MapPickPoint extends BaseData {
    static async load(path, map, groups) {
        return loadData(path, async (data) => {
            const point = new MapPickPoint(data);
            point.map = map;
            point.group = getProperty(groups, data.GroupID);
            if (point.group) {
                point.group.maps.push(point);
            }
            return point;
        });
    }
}
class CharaData extends BaseData {
    constructor() {
        super(...arguments);
        this.params = [];
    }
    static async load(path, names) {
        return loadData(path, async (data) => {
            const chara = new CharaData(data);
            chara.name = getProperty(names, data.nameId);
            return chara;
        });
    }
}
class CharaParameter extends BaseData {
    constructor() {
        super(...arguments);
        this.enemies = [];
    }
    static async load(path, charas) {
        return loadData(path, async (data) => {
            const param = new CharaParameter(data);
            param.chara = getProperty(charas, data.charaID);
            if (param.chara) {
                param.chara.params.push(param);
            }
            return param;
        });
    }
}
class EnemyPlacementConfig extends BaseData {
    constructor(data, group, params, drops) {
        super(data);
        this.group = group;
        this.param = getProperty(params, data.paramId.Name);
        if (this.param) {
            this.param.enemies.push(this);
        }
        this.drop = getProperty(drops, data.Drop.itemData.tableGroupId);
        if (this.drop) {
            this.drop.enemies.push(this);
        }
    }
}
class EnemyGroupConfig extends BaseData {
    static async load(path, map, params, drops) {
        return await loadData(path, async (data) => {
            const group = new EnemyGroupConfig(data);
            group.map = map;
            group.enemies = data.Enemy.map(item => new EnemyPlacementConfig(item, group, params, drops));
            return group;
        });
    }
}
class MapData extends BaseData {
    static async load(path, names, pick_groups, enemy_params, drops) {
        return loadData(path, async (data) => {
            const map = new MapData(data);
            map.name = getProperty(names, data.mapName);
            map.pick_points = await MapPickPoint.load(`GameData/Map/${data.mapId}/${data.mapId}_GDSMapPickPoint.json`, map, pick_groups);
            map.enemies = await EnemyGroupConfig.load(`GameData/Map/${data.mapId}/${data.mapId}_GDSMapEnemyPlacementConfig.json`, map, enemy_params, drops);
            return map;
        });
    }
}
class RecipeItemInfo extends BaseData {
    constructor(data, recipe, items) {
        super(data);
        this.recipe = recipe;
        this.item = getProperty(items, data.ItemId);
        if (this.item) {
            this.item.material_for.push(this);
        }
    }
}
class RecipeData extends BaseData {
    static async load(path, items) {
        return await loadData(path, async (data) => {
            const recipe = new RecipeData(data);
            recipe.item = getProperty(items, data.ItemId);
            if (recipe.item) {
                recipe.item.created_by.push(recipe);
            }
            recipe.item_list = data.itemList.map(item => new RecipeItemInfo(item, recipe, items));
            return recipe;
        });
    }
}
const ITEM_CATEGORIES = [
    'Armor',
    'Consume',
    'Craft',
    'Important',
    'Kit',
    'LifeTools',
    'Material',
    'PowerUp',
    'Recipe',
    'Vehicle',
    'Weapon',
];
class GameData {
    static async load(lang = 'en') {
        const data = new GameData();
        data.item_names = await TextData.load('GameData/Item/GDSItemText_Noun.json', 'textInfo', `nounSingularForm_${lang}`);
        data.item_descs = await TextData.load('GameData/Item/GDSItemText.json', 'textInfo', `text_${lang}`);
        data.all_items = new Map();
        data.item_categories = new Map();
        for (let category of ITEM_CATEGORIES) {
            const items = await ItemData.load(`GameData/Item/GDSItem${category}Data.json`, data.item_names, data.item_descs);
            items.forEach((value, key) => data.all_items.set(key, value));
            data.item_categories.set(category, items);
        }
        data.battle_item_tables = await ItemTableSetting.load('GameData/Item/GDSBattleItemTableSetting.json', data.all_items);
        data.battle_item_groups = await ItemTableGroupSetting.load('GameData/Item/GDSBattleItemTableGroupSetting.json', data.battle_item_tables);
        data.common_pick_params = await CommonPickParamData.load('GameData/Map/GDSCommonPickParamData.json', data.battle_item_groups);
        data.fishing_params = await CommonPickParamData.load('GameData/Map/GDSFishingParamData.json', data.battle_item_groups);
        data.vegetable_params = await VegetableParamData.load('GameData/Map/GDSVegetableParamData.json', data.battle_item_groups);
        data.pick_params = await PickParamData.load('GameData/Map/GDSPickParamData.json', data.common_pick_params, data.fishing_params, data.vegetable_params);
        data.pick_groups = await PickPointGroup.load('GameData/Map/GDSPickPointGroup.json', data.pick_params);
        data.chara_names = await TextData.load('GameData/Chara/GDSCharaText_Noun.json', 'textInfo', `nounSingularForm_${lang}`);
        data.chara_data = await CharaData.load('GameData/Chara/GDSCharaData.json', data.chara_names);
        data.enemy_params = await CharaParameter.load('GameData/Chara/GDSCharaParameterEnemy.json', data.chara_data);
        data.map_names = await TextData.load('GameData/Map/GDSMapText_Noun.json', 'nounInfo', `nounSingularForm_${lang}`);
        data.map_data = await MapData.load('GameData/Map/GDSMapData.json', data.map_names, data.pick_groups, data.enemy_params, data.battle_item_groups);
        data.recipe_data = await RecipeData.load('GameData/Recipe/GDSRecipeData.json', data.all_items);
        return data;
    }
}
//# sourceMappingURL=main.js.map