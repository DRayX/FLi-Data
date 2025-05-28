function isString(value: any): boolean {
  return typeof value === 'string' || value instanceof String;
}

async function loadData<T>(path: string, func: (data: any) => Promise<T>): Promise<Map<string, T>> {
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

function getProperty<T>(map: Map<string, T>, prop: string): T | null {
  return prop == 'None' ? null : map.get(prop) || null;
}

class BaseData {
  raw: any;

  constructor(data: any) {
    this.raw = data;
  }
}

class TextData extends BaseData {
  text: string | null;

  static async load(path: string, text_field: string, lang_field: string): Promise<Map<string, TextData>> {
    return loadData(path, async data => {
      let text = new TextData(data);
      text.text = data[text_field].length ? data[text_field][0][lang_field] : null;
      return text;
    });
  }
}

class ItemData extends BaseData {
  name: TextData | null;
  desc: TextData | null;
  tables: Array<ItemTableDetail> = [];
  material_for: Array<RecipeItemInfo> = [];
  created_by: Array<RecipeData> = [];
  shops: Array<ShopItemInfo> = [];

  static async load(path: string, names: Map<string, TextData>, descs: Map<string, TextData>): Promise<Map<string, ItemData>> {
    return await loadData(path, async data => {
      const item = new ItemData(data);
      item.name = getProperty(names, data.nameId);
      item.desc = getProperty(descs, data.DescId);
      return item;
    });
  }
}

class ItemTableDetail extends BaseData {
  table: ItemTableSetting;
  item: ItemData | null;

  constructor(data: any, table: ItemTableSetting, items: Map<string, ItemData>) {
    super(data);
    this.table = table;
    this.item = getProperty(items, data.ItemId);
    if (this.item) {
      this.item.tables.push(this);
    }
  }
}

class ItemTableSetting extends BaseData {
  data: Array<ItemTableDetail>;
  groups: Array<ItemTableGroupData> = [];

  static async load(path: string, items: Map<string, ItemData>) {
    return await loadData(path, async data => {
      const table = new ItemTableSetting(data);
      table.data = data.tableData.map(item => new ItemTableDetail(item, table, items));
      return table;
    });
  }
}

class ItemTableGroupData extends BaseData {
  group: ItemTableGroupSetting;
  table: ItemTableSetting | null;

  constructor(data: any, group: ItemTableGroupSetting, tables: Map<string, ItemTableSetting>) {
    super(data);
    this.group = group;
    this.table = getProperty(tables, data.tableId);
    if (this.table) {
      this.table.groups.push(this);
    }
  }
}

class ItemTableGroupSetting extends BaseData {
  data: Array<ItemTableGroupData>;
  pick_params: Array<CommonPickParamData> = [];
  vegetable_params: Array<VegetableParamData> = [];
  enemies: Array<EnemyPlacementConfig> = [];

  static async load(path: string, tables: Map<string, ItemTableSetting>): Promise<Map<string, ItemTableGroupSetting>> {
    return await loadData(path, async data => {
      const group = new ItemTableGroupSetting(data);
      group.data = data.tableData.map(item => new ItemTableGroupData(item, group, tables));
      return group;
    });
  }
}

class CommonPickParamData extends BaseData {
  drop: ItemTableGroupSetting | null;
  params: Array<PickParamData> = [];

  static async load(path: string, groups: Map<string, ItemTableGroupSetting>): Promise<Map<string, CommonPickParamData>> {
    return await loadData(path, async data => {
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
  params: Array<PickParamData> = [];
  // todo: drops

  static async load(path: string, groups: Map<string, ItemTableGroupSetting>): Promise<Map<string, VegetableParamData>> {
    return await loadData(path, async data => {
      const param = new VegetableParamData(data);
      return param;
    });
  }
}

class PickParamData extends BaseData {
  name: TextData | null;
  common: CommonPickParamData | null;
  fishing: CommonPickParamData | null;
  vegetable: VegetableParamData | null;
  groups: Array<PickPointGroupData> = [];

  static async load(
      path: string,
      common_params: Map<string, CommonPickParamData>,
      fishing_params: Map<string, CommonPickParamData>,
      vegetable_params: Map<string, VegetableParamData>,
  ): Promise<Map<string, PickParamData>> {
    return await loadData(path, async data => {
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
  group: PickPointGroup;
  param: PickParamData | null;

  constructor(data: any, group: PickPointGroup, params: Map<string, PickParamData>) {
    super(data);
    this.group = group;
    this.param = getProperty(params, data.paramId);
    if (this.param) {
      this.param.groups.push(this);
    }
  }
}

class PickPointGroup extends BaseData {
  data: Array<PickPointGroupData>;
  maps: Array<MapPickPoint> = [];

  static async load(path: string, params: Map<string, PickParamData>): Promise<Map<string, PickPointGroup>> {
    return loadData(path, async data => {
      const group = new PickPointGroup(data);
      group.data = data.groupData.map(item => new PickPointGroupData(item, group, params));
      return group;
    });
  }
}

class MapPickPoint extends BaseData {
  map: MapData;
  group: PickPointGroup | null;

  static async load(path: string, map: MapData, groups: Map<string, PickPointGroup>): Promise<Map<string, MapPickPoint>> {
    return loadData(path, async data => {
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
  name: TextData | null;
  params: Array<CharaParameter> = [];

  static async load(path: string, names: Map<string, TextData>): Promise<Map<string, CharaData>> {
    return loadData(path, async data => {
      const chara = new CharaData(data);
      chara.name = getProperty(names, data.nameId);
      return chara;
    });
  }
}

class CharaParameter extends BaseData {
  chara: CharaData | null;
  enemies: Array<EnemyPlacementConfig> = [];

  static async load(path: string, charas: Map<string, CharaData>): Promise<Map<string, CharaParameter>> {
    return loadData(path, async data => {
      const param = new CharaParameter(data);
      param.chara = getProperty(charas, data.charaID);
      if (param.chara) {
        param.chara.params.push(param);
      }
      return param;
    });
  }
}

class ShopItemInfo extends BaseData {
  shop: ShopData;
  item: ItemData | null;

  constructor(data: any, shop: ShopData, items: Map<string, ItemData>) {
    super(data);
    this.shop = shop;
    this.item = getProperty(items, data.ItemId);
    if (this.item) {
      this.item.shops.push(this);
    }
  }
}

class ShopData extends BaseData {
  name: TextData | null;
  items: Array<ShopItemInfo>;
  maps: Array<MapShopConfigInfo> = [];

  static async load(path: string, text: Map<string, TextData>, items: Map<string, ItemData>): Promise<Map<string, ShopData>> {
    return await loadData(path, async data => {
      const shop = new ShopData(data);
      shop.name = getProperty(text, data.signInfo.buyShopNameIdArray[0]);
      shop.items = data.itemInfoList.map(item => new ShopItemInfo(item, shop, items));
      return shop;
    });
  }
}

class MapShopConfigInfo extends BaseData {
  map: MapShopConfig;
  shop: ShopData | null;

  constructor(data: any, map: MapShopConfig, shops: Map<string, ShopData>) {
    super(data);
    this.map = map;
    this.shop = getProperty(shops, data.shopId);
    if (this.shop) {
      this.shop.maps.push(this);
    }
  }
}

class MapShopConfig extends BaseData {
  map: MapData;
  info: Array<MapShopConfigInfo>;

  static async load(path: string, map: MapData, shops: Map<string, ShopData>): Promise<Map<string, MapShopConfig>> {
    return loadData(path, async data => {
      const shop = new MapShopConfig(data);
      shop.map = map;
      shop.info = data.shopInfoArray.map(item => new MapShopConfigInfo(item, shop, shops));
      return shop;
    });
  }
}

class EnemyPlacementConfig extends BaseData {
  group: EnemyGroupConfig;
  param: CharaParameter | null;
  drop: ItemTableGroupSetting | null;

  constructor(data: any, group: EnemyGroupConfig, params: Map<string, CharaParameter>, drops: Map<string, ItemTableGroupSetting>) {
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
  map: MapData;
  enemies: Array<EnemyPlacementConfig>;

  static async load(
      path: string,
      map: MapData,
      params: Map<string, CharaParameter>,
      drops: Map<string, ItemTableGroupSetting>,
  ): Promise<Map<string, EnemyGroupConfig>> {
    return await loadData(path, async data => {
      const group = new EnemyGroupConfig(data);
      group.map = map;
      group.enemies = data.Enemy.map(item => new EnemyPlacementConfig(item, group, params, drops));
      return group;
    });
  }
}

class MapData extends BaseData {
  name: TextData | null;
  pick_points: Map<string, MapPickPoint>;
  enemies: Map<string, EnemyGroupConfig>;
  shops: Map<string, MapShopConfig>;

  static async load(
      path: string,
      names: Map<string, TextData>,
      pick_groups: Map<string, PickPointGroup>,
      enemy_params: Map<string, CharaParameter>,
      drops: Map<string, ItemTableGroupSetting>,
      shops: Map<string, ShopData>,
  ): Promise<Map<string, MapData>> {
    return loadData(path, async data => {
      const map = new MapData(data);
      map.name = getProperty(names, data.mapName);
      map.pick_points = await MapPickPoint.load(`GameData/Map/${data.mapId}/${data.mapId}_GDSMapPickPoint.json`, map, pick_groups);
      map.enemies = await EnemyGroupConfig.load(`GameData/Map/${data.mapId}/${data.mapId}_GDSMapEnemyPlacementConfig.json`, map, enemy_params, drops);
      map.shops = await MapShopConfig.load(`GameData/Shop/Map/${data.mapId}/${data.mapId}_GDSMapShopConfig.json`, map, shops);
      return map;
    });
  }
}

class RecipeItemInfo extends BaseData {
  recipe: RecipeData;
  item: ItemData | null;

  constructor(data: any, recipe: RecipeData, items: Map<string, ItemData>) {
    super(data);
    this.recipe = recipe;
    this.item = getProperty(items, data.ItemId);
    if (this.item) {
      this.item.material_for.push(this);
    }
  }
}

class RecipeData extends BaseData {
  item: ItemData | null;
  item_list: Array<RecipeItemInfo>;

  static async load(path: string, items: Map<string, ItemData>): Promise<Map<string, RecipeData>> {
    return await loadData(path, async data => {
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
  item_names: Map<string, TextData>;
  item_descs: Map<string, TextData>;
  all_items: Map<string, ItemData>;
  item_categories: Map<string, Map<string, ItemData>>;
  battle_item_tables: Map<string, ItemTableSetting>;
  battle_item_groups: Map<string, ItemTableGroupSetting>;
  common_pick_params: Map<string, CommonPickParamData>;
  fishing_params: Map<string, CommonPickParamData>;
  vegetable_params: Map<string, VegetableParamData>;
  pick_params: Map<string, PickParamData>;
  pick_groups: Map<string, PickPointGroup>;
  chara_names: Map<string, TextData>;
  chara_data: Map<string, CharaData>;
  enemy_params: Map<string, CharaParameter>;
  menu_text: Map<string, TextData>;
  shop_data: Map<string, ShopData>;
  map_names: Map<string, TextData>;
  map_data: Map<string, MapData>;
  recipe_data: Map<string, RecipeData>;

  static async load(lang: string = 'en') {
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
    data.battle_item_groups = await ItemTableGroupSetting.load('GameData/Item/GDSBattleItemTableGroupSetting.json', data.battle_item_tables)
    data.common_pick_params = await CommonPickParamData.load('GameData/Map/GDSCommonPickParamData.json', data.battle_item_groups);
    data.fishing_params = await CommonPickParamData.load('GameData/Map/GDSFishingParamData.json', data.battle_item_groups);
    data.vegetable_params = await VegetableParamData.load('GameData/Map/GDSVegetableParamData.json', data.battle_item_groups);
    data.pick_params = await PickParamData.load('GameData/Map/GDSPickParamData.json', data.common_pick_params, data.fishing_params, data.vegetable_params);
    data.pick_groups = await PickPointGroup.load('GameData/Map/GDSPickPointGroup.json', data.pick_params);
    data.chara_names = await TextData.load('GameData/Chara/GDSCharaText_Noun.json', 'textInfo', `nounSingularForm_${lang}`);
    data.chara_data = await CharaData.load('GameData/Chara/GDSCharaData.json', data.chara_names);
    data.enemy_params = await CharaParameter.load('GameData/Chara/GDSCharaParameterEnemy.json', data.chara_data);
    data.menu_text = await TextData.load('GameData/Menu/GDSMenuText.json', 'textInfo', `text_${lang}`);
    data.shop_data = await ShopData.load('GameData/Shop/GDSShopData.json', data.menu_text, data.all_items);
    data.map_names = await TextData.load('GameData/Map/GDSMapText_Noun.json', 'nounInfo', `nounSingularForm_${lang}`);
    data.map_data = await MapData.load('GameData/Map/GDSMapData.json', data.map_names, data.pick_groups, data.enemy_params, data.battle_item_groups, data.shop_data);
    data.recipe_data = await RecipeData.load('GameData/Recipe/GDSRecipeData.json', data.all_items);
    return data;
  }
}