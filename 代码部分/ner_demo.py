import torch
from fastapi import FastAPI
from pydantic import BaseModel
from transformers import AutoTokenizer, AutoModelForTokenClassification, pipeline

# 加载模型和分词器
model_path = "./my_best_model"
tokenizer = AutoTokenizer.from_pretrained(model_path)
model = AutoModelForTokenClassification.from_pretrained(model_path)

# 标签列表
label_list = ['O', 'B-PER', 'I-PER', 'B-ORG', 'I-ORG', 'B-LOC', 'I-LOC']

# 更改模型的映射表
model.config.id2label = {idx: label for idx, label in enumerate(label_list)}

# 创建 NER 管道
device = 0 if torch.cuda.is_available() else -1
ner_pipeline = pipeline("ner", model=model, tokenizer=tokenizer, device=device, aggregation_strategy="simple")

app = FastAPI()

# 定义请求体
class RequestData(BaseModel):
    text: str

# 映射表
PER_map = {"小 明": "A ", "二 毛": "B "}
LOC_map = {"北 京": "0 ", "南 京":"3 "}

# 定义一个 POST 请求的接口
@app.post("/predict")
async def predict(request: RequestData):
    # 对输入文本进行编码
    res = ner_pipeline(request.text)
    ner_res = ""
    for r in res:
        if r['entity_group'] == 'LOC':
            ner_res +=  LOC_map[r['word']]
        if r['entity_group'] == 'PER':
            ner_res +=  PER_map[r['word']]
    return {"prediction": ner_res}

# 运行命令（在命令行中）: uvicorn ner_demo:app--host 0.0.0.0 --port 8000 --reload